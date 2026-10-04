import { createHash } from "node:crypto";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";

const ENDPOINT = "http://127.0.0.1:18180/api/delegation/execute";
const TOKEN_ENV = "EVENIO_DELEGATION_TOKEN";
const DEFAULT_MAX_WRITE_BYTES = 64 * 1024;
const MAX_WRITE_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

function resolveMaxWriteBytes(config: Record<string, unknown>): number {
  const raw = config.maxWriteBytes;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_MAX_WRITE_BYTES;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_WRITE_BYTES) {
    throw new Error(
      `evenio_control maxWriteBytes must be an integer between 1 and ${MAX_WRITE_BYTES}`,
    );
  }
  return value;
}

function runKey(runId: string): string {
  return createHash("sha256").update(runId, "utf8").digest("hex").slice(0, 24);
}

function errorResult(
  message: string,
  code: string,
  timedOut = false,
): AdapterExecutionResult {
  return {
    exitCode: timedOut ? null : 1,
    signal: null,
    timedOut,
    errorMessage: message,
    errorCode: code,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const token = process.env[TOKEN_ENV]?.trim() ?? "";
  if (token.length < 32) {
    return errorResult(
      `${TOKEN_ENV} is required and must be at least 32 characters.`,
      "evenio_delegation_token_missing",
    );
  }

  let maxWriteBytes: number;
  try {
    maxWriteBytes = resolveMaxWriteBytes(ctx.config);
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : "Invalid Evenio adapter configuration.",
      "evenio_config_invalid",
    );
  }

  const key = runKey(ctx.runId);
  const taskId = `PAPERCLIP-RUN-${key}`;
  const workspacePath = `runs/${key}.json`;
  const handoff = {
    schema: "paperclip-evenio-run-v1",
    run_id: ctx.runId,
    agent_id: ctx.agent.id,
    context: ctx.context,
  };
  const content = JSON.stringify(handoff, null, 2) + "\n";
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > maxWriteBytes) {
    return errorResult(
      `Evenio handoff is ${bytes} bytes, exceeding delegated ceiling ${maxWriteBytes}.`,
      "evenio_handoff_too_large",
    );
  }

  const payload = {
    envelope: {
      task_id: taskId,
      origin_runtime_identity: "paperclip.fasthost.evenio",
      target_runtime_identity: "fasthost.evenio",
      target_agent_identity: "evenio-control-agent",
      objective: `Persist Paperclip run handoff ${ctx.runId} in the bounded private workspace.`,
      evidence_refs: [
        `paperclip:run:${ctx.runId}`,
        `paperclip:agent:${ctx.agent.id}`,
      ],
      authority_ceiling: ["write_runtime"],
      allowed_capability_profile: ["workspace_write"],
      resource_budget: { max_write_bytes: maxWriteBytes },
      deadline: null,
      expected_result_schema: { type: "object" },
      return_route: `paperclip:run:${ctx.runId}`,
      recursion_depth: 0,
    },
    action_tool: "workspace_write",
    action_arguments: {
      path: workspacePath,
      content,
      expected_sha256: "absent",
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await ctx.onLog(
      "stdout",
      `[evenio-control] dispatch run=${ctx.runId} task=${taskId} path=${workspacePath} bytes=${bytes}\n`,
    );
    ctx.onDispatch?.();

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const detail = asRecord(parsed)?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : `Evenio delegation ingress returned HTTP ${response.status}.`;
      return errorResult(message, `evenio_http_${response.status}`);
    }

    const root = asRecord(parsed);
    const result = asRecord(root?.result);
    const receipt = asRecord(result?.receipt);
    const receiptResult = asRecord(receipt?.result);
    if (
      root?.stable_runtime_id !== "fasthost.evenio" ||
      root?.tool !== "delegation_execute" ||
      root?.authority_ceiling !== "write_runtime" ||
      receipt?.task_id !== taskId ||
      receipt?.completion_state !== "COMPLETE" ||
      receiptResult?.path !== workspacePath
    ) {
      return errorResult(
        "Evenio delegation receipt failed identity/result validation.",
        "evenio_receipt_invalid",
      );
    }

    const replay = result?.idempotent_replay === true;
    await ctx.onLog(
      "stdout",
      `[evenio-control] accepted task=${taskId} replay=${replay} path=${workspacePath}\n`,
    );
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "evenio",
      summary: replay
        ? `Evenio replayed bounded handoff for Paperclip run ${ctx.runId}.`
        : `Evenio accepted bounded handoff for Paperclip run ${ctx.runId}.`,
      resultJson: parsed,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResult(
        `Evenio delegation ingress timed out after ${REQUEST_TIMEOUT_MS}ms.`,
        "evenio_timeout",
        true,
      );
    }
    return errorResult(
      error instanceof Error ? error.message : "Evenio delegation request failed.",
      "evenio_request_failed",
    );
  } finally {
    clearTimeout(timer);
  }
}
