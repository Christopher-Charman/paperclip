# Evenio delegation adapter contract

Status: source-level contract only. This document does not authorize deployment, public mutation, business automation, or a wider Evenio control surface.

## Purpose

Paperclip may orchestrate Evenio business-agent work, but it must not become the inference owner, shell authority, runtime identity authority, or concurrency authority. The adapter boundary therefore targets an Evenio-owned delegation endpoint and carries explicit identity/authority fields on every invocation.

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

## Transport boundary

The production adapter endpoint MUST be an Evenio-owned authenticated delegation endpoint. For an in-runtime Paperclip deployment the preferred endpoint is loopback-only. The adapter MUST NOT call Ollama directly as a substitute for delegation: Ollama is an inference resource behind the Evenio agent/runtime boundary, not Paperclip's authority surface.

The adapter MUST NOT introduce generic shell execution, arbitrary filesystem mutation, or credential forwarding.

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

## Fail-closed deployment gate

Until an Evenio-owned task-execution delegation endpoint is independently accepted for this purpose, the implementation state is `CONTRACT_READY / EXECUTION_DISABLED`. Existing read-only `evenio-control-v1` tools (`runtime_health`, `control_state`, `runtime_audit`, `delegation_probe`) MUST NOT be repurposed into arbitrary task execution.

Enabling execution requires separate runtime evidence and deployment authority. It does not authorize publication, spend, payout/KYC action, or public/commercial mutation.
