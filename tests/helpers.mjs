/**
 * Session cookie jar for API tests.
 *
 * isolation.js keys each in-memory store on an `sid` cookie and mints a fresh
 * seeded copy whenever that cookie is absent. Node's fetch does not persist
 * cookies, so without a jar every request sees a brand-new store: a POST that
 * "succeeds" then vanishes from the next GET, and every create-then-assert
 * result becomes meaningless.
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { before, after, beforeEach } from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3014);
export const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

let cookie = null;
let child = null;
let spawnedByHarness = false;

export async function api(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (options.body != null && !headers['Content-Type']) {
    // express.json() only parses when this header is present
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...options,
    headers,
    redirect: 'manual',
    body:
      options.body != null && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });

  // getSetCookie() needs Node 18.14+. Fall back to the raw header if absent.
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')]
        : [];
  for (const c of setCookies) {
    const m = /^sid=[^;]+/i.exec(String(c).trim());
    if (m) cookie = m[0];
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, json, body: json, text, ok: res.ok };
}

export function clearJar() {
  cookie = null;
}

/** Establish sid first — reset without a cookie would wipe a brand-new store, not ours. */
export async function resetData() {
  await api('/api/agents');
  const r = await api('/api/reset', { method: 'POST' });
  if (r.status !== 200) {
    throw new Error('reset failed: ' + JSON.stringify(r.body));
  }
  return r;
}

export const resetStore = resetData;

export async function getLogs(query = '') {
  const q = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  return api(`/api/logs${q}`);
}

export async function getAnalytics() {
  return api('/api/analytics');
}

export async function postLog(body) {
  return api('/api/logs', { method: 'POST', body });
}

/** Expectations derived from raw rows (strict agentId ===) so assertions survive seed changes. */
export function recomputeFromLogs(logs, agents) {
  return agents.map((agent) => {
    const agentLogs = logs.filter((l) => l.agentId === agent.id);
    const totalMinutes = agentLogs.reduce((s, l) => s + Number(l.minutes), 0);
    const entryCount = agentLogs.length;
    const avgMinutes = entryCount ? totalMinutes / entryCount : 0;
    const totalHours = totalMinutes / 60;
    return {
      agentId: agent.id,
      name: agent.name,
      entryCount,
      totalMinutes,
      totalHours,
      avgMinutes,
    };
  });
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

async function ping() {
  try {
    return (await fetch(`${BASE_URL}/api/agents`)).ok;
  } catch {
    return false;
  }
}

async function waitForServer(attempts = 75) {
  for (let i = 0; i < attempts; i++) {
    if (await ping()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not come up on ${BASE_URL}`);
}

export function installServerHarness() {
  before(async () => {
    if (process.env.BASE_URL) return;
    if (await ping()) return;
    if (await portOpen(PORT)) {
      await waitForServer();
      return;
    }
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'ignore',
    });
    spawnedByHarness = true;
    child.on('exit', (code) => {
      if (spawnedByHarness && code && code !== 0) {
        console.error('server exited early:', code);
      }
    });
    await waitForServer();
  });

  after(() => {
    if (child && spawnedByHarness) {
      spawnedByHarness = false;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      child = null;
    }
  });

  beforeEach(async () => {
    await resetData();
  });
}
