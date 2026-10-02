#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function fail(message) { console.error(`FAIL: ${message}`); process.exitCode = 1; }
function versionTuple(v) { return v.replace(/^v/, '').split('.').map(Number); }
function atLeast(actual, required) {
  const a = versionTuple(actual), r = versionTuple(required);
  for (let i = 0; i < Math.max(a.length, r.length); i++) {
    if ((a[i] ?? 0) > (r[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (r[i] ?? 0)) return false;
  }
  return true;
}

console.log('Evenio Paperclip native-host preflight (read-only)');
if (!atLeast(process.version, '24.11.0')) fail(`Node ${process.version} < required 24.11.0`);

try {
  const pnpm = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
  if (!atLeast(pnpm, '9.15.4')) fail(`pnpm ${pnpm} < required 9.15.4`);
  else console.log(`pnpm ${pnpm}: OK`);
} catch { fail('pnpm unavailable'); }

const envPath = new URL('./paperclip.env.example', import.meta.url);
if (!fs.existsSync(envPath)) fail('managed-host example config missing');
else {
  const text = fs.readFileSync(envPath, 'utf8');
  if (!text.includes('HOST=127.0.0.1')) fail('loopback host contract missing');
  if (/HOST=0\.0\.0\.0/.test(text)) fail('public bind forbidden');
}

console.log(`Node ${process.version}: ${atLeast(process.version, '24.11.0') ? 'OK' : 'INCOMPATIBLE'}`);
console.log(process.exitCode ? 'Preflight: FAIL' : 'Preflight: PASS');
