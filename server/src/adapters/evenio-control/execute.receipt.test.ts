import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { acceptedDelegationReceipt } from "./execute.js";

const taskId = "PAPERCLIP-RUN-0123456789abcdef01234567";
const workspacePath = "runs/0123456789abcdef01234567.json";
const content = '{"schema":"paperclip-evenio-run-v1"}\n';
const maxBytes = 65536;
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const argumentDigest = sha(JSON.stringify({
  content,
  expected_sha256: "absent",
  path: workspacePath,
}));
const envelopeDigest = "a".repeat(64);

function goodReceipt() {
  return {
    stable_runtime_id: "fasthost.evenio",
    tool: "delegation_execute",
    authority_ceiling: "write_runtime",
    result: {
      admission: {
        task_id: taskId,
        admitted: true,
        target_runtime_identity: "fasthost.evenio",
        target_agent_identity: "evenio-control-agent",
        effective_authority: ["write_runtime"],
        effective_capabilities: ["workspace_write"],
        envelope_sha256: envelopeDigest,
      },
      receipt: {
        task_id: taskId,
        executor_identity: "evenio-control-agent",
        runtime_receipt: {
          stable_runtime_id: "fasthost.evenio",
          execution_surface: "evenio-control-v1 -> bounded-workspace-execution",
          observed_at: "2026-11-04T00:00:00+00:00",
        },
        actions_taken: [{ capability: "workspace_write", arguments_sha256: argumentDigest }],
        evidence_refs: ["envelope_sha256:" + envelopeDigest],
        result: {
          capability: "workspace_write",
          workspace: "paperclip-private",
          path: workspacePath,
          created: true,
          before_sha256: null,
          after_sha256: sha(content),
          bytes_written: Buffer.byteLength(content, "utf8"),
        },
        unresolved_items: [],
        resource_usage: { bounded_actions: 1, bytes_written: Buffer.byteLength(content, "utf8") },
        completion_state: "COMPLETE",
      },
      idempotent_replay: false,
    },
  };
}

type Receipt = ReturnType<typeof goodReceipt>;

describe("Evenio bounded delegation receipt", () => {
  it("accepts an exact bound successful write and its idempotent replay", () => {
    const accepted = goodReceipt();
    expect(acceptedDelegationReceipt(accepted, taskId, workspacePath, content, maxBytes)).toBe(true);
    accepted.result.idempotent_replay = true;
    expect(acceptedDelegationReceipt(accepted, taskId, workspacePath, content, maxBytes)).toBe(true);
  });

  const invalid: Array<[string, (r: Receipt) => void]> = [
    ["wrong outer runtime", (r) => { r.stable_runtime_id = "other.runtime"; }],
    ["wrong admitted runtime", (r) => { r.result.admission.target_runtime_identity = "other.runtime"; }],
    ["wrong admitted executor", (r) => { r.result.admission.target_agent_identity = "other-agent"; }],
    ["missing authority", (r) => { r.result.admission.effective_authority = []; }],
    ["missing capability", (r) => { r.result.admission.effective_capabilities = []; }],
    ["wrong admission task", (r) => { r.result.admission.task_id = "other-task"; }],
    ["wrong receipt task", (r) => { r.result.receipt.task_id = "other-task"; }],
    ["wrong receipt executor", (r) => { r.result.receipt.executor_identity = "other-agent"; }],
    ["wrong nested runtime", (r) => { r.result.receipt.runtime_receipt.stable_runtime_id = "other.runtime"; }],
    ["missing timestamp", (r) => { r.result.receipt.runtime_receipt.observed_at = ""; }],
    ["wrong action", (r) => { r.result.receipt.actions_taken[0].capability = "unrestricted_command"; }],
    ["wrong action digest", (r) => { r.result.receipt.actions_taken[0].arguments_sha256 = "b".repeat(64); }],
    ["missing envelope evidence", (r) => { r.result.receipt.evidence_refs = []; }],
    ["malformed envelope digest", (r) => { r.result.admission.envelope_sha256 = "short"; }],
    ["unresolved work", (r) => { r.result.receipt.unresolved_items = ["pending"]; }],
    ["wrong result path", (r) => { r.result.receipt.result.path = "runs/other.json"; }],
    ["wrong result hash", (r) => { r.result.receipt.result.after_sha256 = "b".repeat(64); }],
    ["wrong result bytes", (r) => { r.result.receipt.result.bytes_written = 0; }],
    ["wrong resource usage", (r) => { r.result.receipt.resource_usage.bytes_written = 0; }],
    ["missing execution count", (r) => { r.result.receipt.resource_usage.bounded_actions = 0; }],
    ["unfinished", (r) => { r.result.receipt.completion_state = "FAILED"; }],
    ["not-created write", (r) => { r.result.receipt.result.created = false; }],
    ["malformed replay indicator", (r) => { (r.result as { idempotent_replay: unknown }).idempotent_replay = "true"; }],
  ];

  for (const [name, mutate] of invalid) {
    it("rejects " + name, () => {
      const value = goodReceipt();
      mutate(value);
      expect(acceptedDelegationReceipt(value, taskId, workspacePath, content, maxBytes)).toBe(false);
    });
  }

  it("rejects a valid receipt when caller content or ceiling differs", () => {
    const value = goodReceipt();
    expect(acceptedDelegationReceipt(value, taskId, workspacePath, content + "x", maxBytes)).toBe(false);
    expect(acceptedDelegationReceipt(value, taskId, workspacePath, content, 1)).toBe(false);
    expect(acceptedDelegationReceipt(null, taskId, workspacePath, content, maxBytes)).toBe(false);
  });
});
