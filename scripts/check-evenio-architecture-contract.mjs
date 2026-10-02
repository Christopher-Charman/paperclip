import fs from 'node:fs';

const baselinePath = new URL('../docs/evenio/ARCHITECTURE_BASELINE.md', import.meta.url);
const text = fs.readFileSync(baselinePath, 'utf8');

const required = [
  'MODEL != ACTOR != ROLE != ROLE_ASSIGNMENT != SESSION != TASK != RUN != LEASE',
  '127.0.0.1',
  'No Docker/Compose dependency',
  'test / RED / automation OFF / public mutation OFF / STOP ON',
  'paperclip.evenio.online',
  'Ollama `127.0.0.1:11434`',
  'Concurrency Ledger',
  'evenio-control-v1',
  'not deployment authority',
];

const missing = required.filter((needle) => !text.includes(needle));
if (missing.length) {
  console.error(`Evenio architecture contract missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [
  /(?:^|\n)\s*(?:Paperclip\s+)?(?:must|will|shall)?\s*bind(?:ing)?\s+(?:to\s+)?0\.0\.0\.0/im,
  /(?:^|\n)\s*(?:Paperclip\s+)?(?:must|will|shall)?\s*replace(?:s|d)?\s+(?:the\s+)?Concurrency Ledger/im,
  /generic shell authority is (?:allowed|enabled)(?:\.|\n|$)/i,
];

const violations = forbidden.filter((pattern) => pattern.test(text));
if (violations.length) {
  console.error(`Evenio architecture contract violation: ${violations.map(String).join(', ')}`);
  process.exit(1);
}

console.log('Evenio architecture contract: PASS');
