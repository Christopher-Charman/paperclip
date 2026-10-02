import fs from 'node:fs';

const path = new URL('../deploy/evenio/paperclip.env.example', import.meta.url);
const text = fs.readFileSync(path, 'utf8');
const env = Object.fromEntries(text.split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => {
  const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)];
}));

const expected = {
  HOST: '127.0.0.1',
  PAPERCLIP_BIND: 'loopback',
  PAPERCLIP_DEPLOYMENT_EXPOSURE: 'private',
  PAPERCLIP_AUTH_DISABLE_SIGN_UP: 'true',
  PAPERCLIP_SECRETS_STRICT_MODE: 'true',
  HEARTBEAT_SCHEDULER_ENABLED: 'false',
  PAPERCLIP_ANNOUNCEMENTS_ENABLED: 'false',
};
for (const [key, value] of Object.entries(expected)) {
  if (env[key] !== value) throw new Error(`${key} must be ${value}`);
}
if (!env.PAPERCLIP_PUBLIC_URL?.startsWith('https://')) throw new Error('public URL must use HTTPS');
if (env.DATABASE_URL) throw new Error('example must not carry a live database URL');
if (/0\.0\.0\.0/.test(text)) throw new Error('public bind forbidden for Evenio managed-host contract');
console.log('Evenio managed-host config contract: PASS');
