#!/usr/bin/env node
import fs from 'node:fs';

const path = new URL('../docs/evenio/delegation-adapter-contract.md', import.meta.url);
const text = fs.readFileSync(path, 'utf8');

const required = [
  'MODEL != ACTOR != ROLE != ROLE_ASSIGNMENT != SESSION != TASK != RUN != LEASE',
  'target_runtime_id = fasthost.evenio',
  'task_id',
  'origin_runtime_identity',
  'target_agent_identity',
  'authority_ceiling',
  'allowed_capability_profile',
  'resource_budget',
  'deadline',
  'expected_result_schema',
  'return_route',
  'executor_identity',
  'runtime_receipt',
  'actions',
  'evidence_refs',
  'resource_usage',
  'completion_state',
  'existing Evenio-owned authenticated control plane',
  'delegation_execute',
  'workspace_write',
  '127.0.0.1:18180/api/delegation/execute',
  'EVENIO_DELEGATION_TOKEN',
  'runtime_health',
  'control_state',
  'runtime_audit',
  'delegation_probe',
];

const forbidden = [
  /target_runtime_id\s*=\s*fasthost\.powerpc/i,
  /unaudited unrestricted `exec\(arbitrary_command\)` backdoor (?:is|shall be|becomes) (?:enabled|allowed|authorized)/i,
  /publication authorized\s*:\s*true/i,
  /public mutation (?:is|shall be|becomes) (?:enabled|allowed|authorized)/i,
];

const missing = required.filter((token) => !text.includes(token));
const violations = forbidden.filter((pattern) => pattern.test(text)).map(String);

if (missing.length || violations.length) {
  if (missing.length) console.error(`Missing required delegation contract tokens: ${missing.join(', ')}`);
  if (violations.length) console.error(`Forbidden delegation contract patterns matched: ${violations.join(', ')}`);
  process.exit(1);
}

console.log('Evenio delegation adapter contract: PASS');
