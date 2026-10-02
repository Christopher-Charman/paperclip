import fs from 'node:fs';
const url = new URL('../docs/evenio/IDENTITY_MAPPING_CONTRACT.json', import.meta.url);
const c = JSON.parse(fs.readFileSync(url, 'utf8'));
const expected = ['MODEL','ACTOR','ROLE','ROLE_ASSIGNMENT','SESSION','TASK','RUN','LEASE'];
if (JSON.stringify(c.invariant) !== JSON.stringify(expected)) throw new Error('identity invariant changed');
const rules = c.rules ?? {};
for (const [name, value] of Object.entries(rules)) {
  if (value !== false) throw new Error(`fail-closed rule ${name} must remain false`);
}
if (c.external_authority?.coordination !== 'Concurrency Ledger') throw new Error('coordination authority changed');
if (c.external_authority?.control !== 'evenio-control-v1') throw new Error('control authority changed');
if (c.external_authority?.local_tools !== 'Evenio local MCP') throw new Error('local tool authority changed');
console.log('Evenio identity mapping contract: PASS');
