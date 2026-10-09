# Evenio-native Paperclip architecture baseline

Status: design/adaptation baseline; **not deployment authority**.

Upstream baseline: `paperclipai/paperclip@c83df091b1a5207375eaf23466bb5c62e4e1518e`.
Evenio branch: `evenio/native-control-plane`.
Runtime target: Evenio managed runtime. Runtime account identity and filesystem roots are private deployment configuration and must not be committed to this public fork.

## Non-negotiable boundaries

1. Paperclip is business-agent orchestration/UI scaffolding. It does not replace the existing Evenio control receiver, local MCP, delegation path, Ollama inference service, or the architecture-wide Concurrency Ledger.
2. Preserve `MODEL != ACTOR != ROLE != ROLE_ASSIGNMENT != SESSION != TASK != RUN != LEASE`.
3. No generic shell authority is introduced into `evenio-control-v1`.
4. The service must bind to `127.0.0.1`; browser exposure is only through managed HTTPS ingress.
5. No Docker/Compose dependency for the Evenio deployment path.
6. Existing safety state remains `test / RED / automation OFF / public mutation OFF / STOP ON` until a separately authorized transition.
7. This branch does not authorize live deployment, publishing, spend, payout/KYC mutation, or autonomous business execution.

## Upstream inventory

| Upstream area | Observed role | Evenio treatment |
| --- | --- | --- |
| `server/` | TypeScript API/runtime; auth, agent-run cancellation, board claims, configuration, scheduler/service logic | Retain application layer; configure localhost-only and authenticated managed ingress |
| `ui/` | React/Vite dashboard and service worker | Retain as business operations UI; keep separate from powerpc-darwin.org OpenWebUI |
| `packages/db/` | PostgreSQL-backed durable business/agent state and schemas | Retain for Paperclip-owned business state only; do not make it concurrency authority |
| `packages/adapters/` | Local/cloud agent adapter boundary | Adapt here for Evenio/Ollama and bounded existing delegation contracts |
| `packages/mcp-server/` | Paperclip MCP surface | Treat as application integration; must not supersede Evenio local MCP authority |
| `packages/paperclip-runner/` | Agent execution/runtime orchestration | Reuse selectively behind explicit authority attenuation |
| `packages/plugins/` | Extension surface | Retain where useful; plugins inherit no ambient Evenio authority |
| `packages/shared/` | Shared contracts/configuration | Reuse, adding Evenio-specific contracts only where they do not duplicate global identity semantics |

## Overlap / adaptation matrix

| Concern | Paperclip primitive | Existing authority | Decision |
| --- | --- | --- | --- |
| Model/provider | adapters/provider defaults | Evenio Ollama at localhost | Add/use an adapter; Paperclip consumes inference, never owns Ollama |
| Actor/agent | `agents`, memberships, config/instruction revisions | Evenio business-agent identity | Paperclip may own business-agent records; bind explicitly to external actor identity where required |
| Session | `agent_task_sessions`, auth sessions | Concurrency Ledger session identity for cross-session coordination | Keep Paperclip sessions application-scoped; never equate them with ledger sessions |
| Task/issue | Paperclip issue/task semantics | Concurrency Ledger task claims for covered coordination lanes | Paperclip may model business work; cross-session ownership/claims adapt to Ledger rather than compete |
| Run | Paperclip runner/runtime state | Ledger run lifecycle for covered coordinated execution | Maintain mapping; no identity collapse |
| Lease/heartbeat | Paperclip heartbeat scheduler/runtime state | Ledger lease/heartbeat semantics | Paperclip heartbeat is liveness/wakeup only; Ledger remains coordination lease authority |
| Control | server actions / adapters / MCP | `evenio-control-v1` + Evenio-local MCP/delegation | Adapter boundary only; no widening of receiver tool semantics |
| Receipts | activity/runtime records | signed/encrypted Evenio result receipts | Preserve authoritative receipt chain; Paperclip can index/reference but not replace it |
| Inference | provider/adapters | Ollama `127.0.0.1:11434` | localhost consumer only |
| UI | React/Vite | managed HTTPS ingress | dedicated host preferred |
| Persistence | embedded/external Postgres | Evenio runtime storage | dedicated Paperclip data directory/database; backup policy explicit |

## Deployment-shape finding

Upstream already defaults the server host to `127.0.0.1` and supports explicit deployment exposure, public auth URL, allowed hostnames, local encrypted secrets, local-disk storage, database backups, and UI serving. These are compatible with a managed-host native deployment without Docker.

The Vite production config does not declare a non-root `base`, while the application includes service-worker behavior and root-oriented API/UI assumptions. Therefore the first Evenio ingress contract is a dedicated hostname (target `paperclip.evenio.online`) rather than a path prefix. A subpath is not admitted unless later tests prove asset, router, API, auth callback and service-worker scope correctness.

## Minimum native topology

```text
browser
  -> managed Fasthosts HTTPS / Passenger ingress
  -> paperclip.evenio.online
  -> localhost Paperclip server (candidate 127.0.0.1:3100)
       -> Paperclip PostgreSQL state
       -> local encrypted secrets/storage
       -> Evenio adapter boundary
            -> Ollama 127.0.0.1:11434 (inference)
            -> existing bounded Evenio local-MCP/delegation contracts
            -> Concurrency Ledger adapter for covered coordination semantics
```

Port `3100` is an upstream default/candidate, not yet a live reservation. Runtime deployment must verify collision-free allocation before binding.

## Implementation sequence

1. Keep upstream lineage clean and perform Evenio work only on this branch/descendants.
2. Add deterministic architecture-contract checks before runtime integration.
3. Implement a first-class Evenio adapter boundary; do not embed shell execution.
4. Add explicit Concurrency Ledger identity/mapping contract for coordinated task/run/session/lease operations.
5. Add native managed-host configuration/bootstrap that validates Node/pnpm/Postgres prerequisites and fails closed.
6. Add ingress/base-path tests and keep dedicated-host deployment as the admitted default.
7. Build/typecheck/test in an isolated non-live environment.
8. Stop before live Evenio deployment or any authority expansion; those require a separate admitted transition.
