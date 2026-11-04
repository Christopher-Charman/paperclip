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

/**
 * Accept only the bounded Evenio workspace-write receipt shape produced by the
 * existing delegation service. This is post-response validation, not a new
 * execution authority or a substitute for the receiver's authentication.
 */
export function acceptedDelegationReceipt(
  payload: unknown,
  taskId: string,
  workspacePath: string,
  content: string,
  maxWriteBytes: number,
): boolean {
  const root = asRecord(payload);
  const result = asRecord(root?.result);
  const admission = asRecord(result?.admission);
  const receipt = asRecord(result?.receipt);
  const runtime = asRecord(receipt?.runtime_receipt);
  const actionResult = asRecord(receipt?.result);
  const resourceUsage = asRecord(receipt?.resource_usage);
  const actions = receipt?.actions_taken;
  const action = Array.isArray(actions) && actions.length === 1 ? asRecord(actions[0]) : null;
  const evidence = receipt?.evidence_refs;
  const unresolved = receipt?.unresolved_items;
  const bytes = Buffer.byteLength(content, "utf8");
  const sha = createHash("sha256").update(content, "utf8").digest("hex");
  // Python receiver canonicalizes JSON with sorted object keys.
  const argsDigest = createHash("sha256")
    .update(JSON.stringify({ content, expected_sha256: "absent", path: workspacePath }), "utf8")
    .digest("hex");
  const envelopeDigest = admission?.envelope_sha256;
  const observedAt = runtime?.observed_at;
  return (
    root?.stable_runtime_id === "fasthost.evenio" &&
    root?.tool === "delegation_execute" &&
    root?.authority_ceiling === "write_runtime" &&
    admission?.task_id === taskId &&
    admission?.admitted === true &&
    admission?.target_runtime_identity === "fasthost.evenio" &&
    admission?.target_agent_identity === "evenio-control-agent" &&
    Array.isArray(admission?.effective_authority) &&
    admission.effective_authority.includes("write_runtime") &&
    Array.isArray(admission?.effective_capabilities) &&
    admission.effective_capabilities.includes("workspace_write") &&
    typeof envelopeDigest === "string" &&
    /^[0-9a-f]{64}$/.test(envelopeDigest) &&
    receipt?.task_id === taskId &&
    receipt?.executor_identity === "evenio-control-agent" &&
    runtime?.stable_runtime_id === "fasthost.evenio" &&
    typeof runtime?.execution_surface === "string" &&
    runtime.execution_surface.length > 0 &&
    typeof observedAt === "string" &&
    /(Z|[+-][0-9]{2}:[0-9]{2})$/.test(observedAt) &&
    Number.isFinite(Date.parse(observedAt)) &&
    receipt?.completion_state === "COMPLETE" &&
    action?.capability === "workspace_write" &&
    action?.arguments_sha256 === argsDigest &&
    Array.isArray(evidence) &&
    evidence.includes("envelope_sha256:" + envelopeDigest) &&
    Array.isArray(unresolved) &&
    unresolved.length === 0 &&
    actionResult?.capability === "workspace_write" &&
    actionResult?.workspace === "paperclip-private" &&
    actionResult?.path === workspacePath &&
    actionResult?.created === true &&
    actionResult?.before_sha256 === null &&
    actionResult?.after_sha256 === sha &&
    actionResult?.bytes_written === bytes &&
    bytes <= maxWriteBytes &&
    resourceUsage?.bounded_actions === 1 &&
    resourceUsage?.bytes_written === bytes &&
    typeof result?.idempotent_replay === "boolean"
  );
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

    if (!acceptedDelegationReceipt(parsed, taskId, workspacePath, content, maxWriteBytes)) {
      return errorResult(
        "Evenio delegation receipt failed identity/result validation.",
        "evenio_receipt_invalid",
      );
    }

    const root = asRecord(parsed);
    const result = asRecord(root?.result);
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
      resultJson: root,
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
