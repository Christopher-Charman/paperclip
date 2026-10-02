# Evenio native managed-host bootstrap

This directory defines a **non-live** deployment contract for `fasthost.evenio`. It is intentionally not an installer.

## Preconditions

- Node >= 24.11.0 (upstream Paperclip engine requirement)
- pnpm >= 9.15.4
- PostgreSQL mode/data location selected and backed up
- collision-free localhost application and database ports
- managed HTTPS hostname admitted, currently designed as `paperclip.evenio.online`
- local encrypted secrets key and local storage paths provisioned with runtime-owner-only permissions
- existing Evenio control/delegation and Concurrency Ledger authority boundaries unchanged

Run `node deploy/evenio/preflight.mjs` only in a candidate checkout to perform read-only prerequisite checks. It does not install packages, bind ports, mutate a database, start services, alter ingress, or deploy anything.

## Deployment authority gate

Do not proceed from preflight into installation/service start/Passenger or DNS configuration until live runtime identity and collision-free resources are freshly verified and a separate deployment transition is authorized. The design target remains localhost-only application binding behind managed HTTPS.
