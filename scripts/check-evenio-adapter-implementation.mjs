#!/usr/bin/env node
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

const execute = read("packages/adapters/evenio-control/src/server/execute.ts");
const serverIndex = read("packages/adapters/evenio-control/src/server/index.ts");
const packageJson = read("packages/adapters/evenio-control/package.json");
const builtin = read("server/src/adapters/builtin-adapter-types.ts");
const serverRegistry = read("server/src/adapters/registry.ts");
const uiRegistry = read("ui/src/adapters/registry.ts");
const cliRegistry = read("cli/src/adapters/registry.ts");
const cliPackage = read("cli/package.json");
const serverPackage = read("server/package.json");
const registryTest = read("server/src/adapters/registry.test.ts");
const releaseManifest = read("scripts/release-package-manifest.json");
const lockfile = read("pnpm-lock.yaml");

const requiredExecute = [
  'const ENDPOINT = "http://127.0.0.1:18180/api/delegation/execute"',
  'const TOKEN_ENV = "EVENIO_DELEGATION_TOKEN"',
  'target_runtime_identity: "fasthost.evenio"',
  'target_agent_identity: "evenio-control-agent"',
  'authority_ceiling: ["write_runtime"]',
  'allowed_capability_profile: ["workspace_write"]',
  'action_tool: "workspace_write"',
  'expected_sha256: "absent"',
  'origin_runtime_identity: "paperclip.fasthost.evenio"',
  'schema: "paperclip-evenio-run-v1"',
  'idempotent_replay',
];

const missing = requiredExecute.filter((token) => !execute.includes(token));

const forbiddenExecute = [
  /config\.url/,
  /config\.headers/,
  /child_process/,
  /spawn\(/,
  /exec\(/,
  /shell\s*:/,
  /git\s+push/i,
  /raw\.githubusercontent\.com/i,
  /api\.github\.com/i,
  /github\.com\/.*queue/i,
];

const violations = forbiddenExecute
  .filter((pattern) => pattern.test(execute))
  .map(String);

const registrationChecks = [
  [serverIndex, "maxWriteBytes", "adapter config schema"],
  [packageJson, '"@paperclipai/adapter-utils": "workspace:*"', "adapter-utils dependency"],
  [builtin, '"evenio_control"', "built-in type"],
  [serverRegistry, '@paperclipai/adapter-evenio-control/server', "server package import"],
  [serverRegistry, 'type: "evenio_control"', "server registration"],
  [uiRegistry, 'type: "evenio_control"', "UI registration"],
  [cliRegistry, 'type: "evenio_control"', "CLI registration"],
  [cliPackage, '"@paperclipai/adapter-evenio-control": "workspace:*"', "CLI workspace dependency"],
  [registryTest, '["evenio_control", "invocation_context"]', "runtime delivery strategy regression"],
  [releaseManifest, '"name": "@paperclipai/adapter-evenio-control"', "release manifest package"],
  [releaseManifest, '"publishFromCi": true', "release manifest CI enrollment"],
  [serverPackage, '"@paperclipai/adapter-evenio-control": "workspace:*"', "server workspace dependency"],
  [lockfile, "packages/adapters/evenio-control:", "lockfile adapter importer"],
  [lockfile, "link:../packages/adapters/evenio-control", "lockfile server link"],
];

for (const [text, token, label] of registrationChecks) {
  if (!text.includes(token)) missing.push(label + ": " + token);
}

if (missing.length || violations.length) {
  if (missing.length) {
    console.error("Missing Evenio adapter implementation invariants: " + missing.join(", "));
  }
  if (violations.length) {
    console.error("Forbidden Evenio adapter primitives: " + violations.join(", "));
  }
  process.exit(1);
}

console.log("Evenio adapter implementation: PASS");
