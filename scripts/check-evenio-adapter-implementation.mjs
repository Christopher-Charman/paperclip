#!/usr/bin/env node
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

const execute = read("server/src/adapters/evenio-control/execute.ts");
const serverIndex = read("server/src/adapters/evenio-control/index.ts");
const builtin = read("server/src/adapters/builtin-adapter-types.ts");
const serverRegistry = read("server/src/adapters/registry.ts");
const uiRegistry = read("ui/src/adapters/registry.ts");
const cliRegistry = read("cli/src/adapters/registry.ts");
const cliPackage = read("cli/package.json");
const serverPackage = read("server/package.json");
const registryTest = read("server/src/adapters/registry.test.ts");
const releaseManifest = read("scripts/release-package-manifest.json");
const dockerfile = read("Dockerfile");

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

const violations = forbiddenExecute.filter((pattern) => pattern.test(execute)).map(String);

const registrationChecks = [
  [serverIndex, "maxWriteBytes", "adapter config schema"],
  [serverIndex, "Evenio Control", "adapter configuration documentation"],
  [builtin, '"evenio_control"', "built-in type"],
  [serverRegistry, '"./evenio-control/index.js"', "server-local import"],
  [serverRegistry, 'type: "evenio_control"', "server registration"],
  [uiRegistry, 'type: "evenio_control"', "UI registration"],
  [cliRegistry, 'type: "evenio_control"', "CLI registration"],
  [registryTest, '["evenio_control", "invocation_context"]', "runtime delivery strategy regression"],
];

for (const [text, token, label] of registrationChecks) {
  if (!text.includes(token)) missing.push(label + ": " + token);
}

for (const [text, label] of [
  [cliPackage, "cli/package.json"],
  [serverPackage, "server/package.json"],
  [releaseManifest, "scripts/release-package-manifest.json"],
  [dockerfile, "Dockerfile"],
]) {
  if (text.includes("@paperclipai/adapter-evenio-control") || text.includes("packages/adapters/evenio-control")) {
    violations.push("obsolete public-package coupling in " + label);
  }
}

if (missing.length || violations.length) {
  if (missing.length) console.error("Missing Evenio adapter implementation invariants: " + missing.join(", "));
  if (violations.length) console.error("Forbidden Evenio adapter primitives/couplings: " + violations.join(", "));
  process.exit(1);
}

console.log("Evenio adapter implementation: PASS");
