# Evenio delegation adapter contract

Status: source-integrated adapter contract. The bounded Evenio `delegation_execute` / `workspace_write` capability and private loopback ingress are accepted infrastructure, but this document does not authorize live Paperclip deployment, public mutation, business automation, or a wider Evenio control surface.

## Purpose

Paperclip may orchestrate Evenio business-agent work, but it must not become the inference owner, runtime identity authority, or concurrency authority. The adapter boundary targets the existing Evenio-owned control plane and carries explicit identity/authority fields on every invocation.

## Identity separation

The adapter MUST preserve:

`MODEL != ACTOR != ROLE != ROLE_ASSIGNMENT != SESSION != TASK != RUN != LEASE`

Paperclip identifiers may be correlated with these identities, but MUST NOT collapse or silently substitute for them.

## Runtime binding

Every request MUST bind:

- `target_runtime_id = fasthost.evenio`
- an explicit `task_id`
- an explicit `origin_runtime_identity`
- an explicit `target_agent_identity`
- `authority_ceiling`
- `allowed_capability_profile`
- `resource_budget`
- `deadline`
- `expected_result_schema`
- `return_route`

The adapter MUST reject an absent or different `target_runtime_id`. Cross-runtime fallback is prohibited.

## Transport and execution boundary

The production adapter MUST extend the existing Evenio-owned authenticated control plane rather than create a parallel task-execution service merely because the currently admitted capabilities are read-only. For an in-runtime Paperclip deployment the preferred endpoint is loopback-only. The adapter MUST NOT call Ollama directly as a substitute for delegation: Ollama is an inference resource behind the Evenio agent/runtime boundary, not Paperclip's authority surface.

Execution capabilities MUST be explicitly admitted, authority-bounded, identity-bound, auditable, idempotent where required, and receipt-producing. The control plane MAY admit filesystem mutation, process control, terminal/command execution, or other powerful operations when their capability contract and authority ceiling explicitly permit them. It MUST NOT expose an unaudited unrestricted `exec(arbitrary_command)` backdoor that bypasses capability admission, authorization, runtime identity binding, or durable receipts.

A request-specific `authority_ceiling = read_only` describes that request/capability admission; it is not a permanent architectural ceiling on the Evenio control plane.

## Result contract

A successful result MUST carry:

- `task_id`
- `executor_identity`
- `target_runtime_id`
- `runtime_receipt`
- `actions`
- `evidence_refs`
- `result`
- `unresolved`
- `resource_usage`
- `completion_state`

The adapter MUST reject a mismatched `task_id` or `target_runtime_id`. Missing receipt/result fields are a run-level failure, not a successful empty result.

## Session semantics

Paperclip heartbeat/session continuity MAY retain a delegation correlation identifier, but that identifier is not an Evenio actor, task, run, lease, or authority grant. Retry MUST preserve idempotent correlation by `task_id`; a retry may not silently create a second logical task.

## Concurrency boundary

Where the scope is registered in the Concurrency Ledger, ledger session/claim/run/lease state remains authoritative for coordination. Paperclip task state is orchestration/UI state and MUST NOT supersede live ledger ownership.

## Execution admission state

The existing Evenio owned-control transport and `evenio-local-mcp` runtime binding are accepted evidence for the control-plane route. The required bounded mutating/delegation profile is also implemented and live-accepted on that control plane: `delegation_execute` admits only bounded `workspace_write` under `write_runtime`, and Paperclip has an accepted private loopback ingress at `127.0.0.1:18180/api/delegation/execute` authenticated by the dedicated `EVENIO_DELEGATION_TOKEN`.

Existing read-only capabilities (`runtime_health`, `control_state`, `runtime_audit`, `delegation_probe`) remain read-only according to their own contracts. The Paperclip adapter MUST continue to use the accepted bounded delegation service; it must not invent a parallel receiver, generic shell, arbitrary HTTP target, or Git-based runtime-state transport.

Accepted infrastructure evidence includes `Christopher-Charman/evenio-online/docs/PAPERCLIP_BOUNDED_EXECUTION.md`, `docs/PAPERCLIP_LOOPBACK_DELEGATION_INGRESS.md`, PR #19 merge `645144a13430401f694f982ef8335db15dc94ed7`, and cross-transport replay receipt `cg-evenio-20261003-paperclip-cross-transport-replay-01`.

Source integration and infrastructure acceptance do not themselves authorize live Paperclip deployment, publication, spend, payout/KYC action, automation enablement, STOP clearing, or public/commercial mutation. Those destination authorities remain independently gated.
