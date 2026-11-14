// One long-lived Chrome DevTools MCP connection to the owner's running Chrome, shared by scripts and agents
// over a private unix socket, so Chrome's "Allow remote debugging?" prompt is accepted once per session.
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, openSync, rmSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { homedir } from 'node:os';
import { StdioMcp } from './verification/stdio-mcp.ts';

const root = new URL('..', import.meta.url).pathname;
const stateDir = `${homedir()}/.local/state/threads-private-api`;
export const CHROME_SOCKET = `${stateDir}/chrome.sock`;
const logFile = `${stateDir}/chrome-session.log`;
// Results of these tools carry request headers and bodies (cookies, tokens); only scripts may read them.
const SCRIPT_ONLY_TOOLS = new Set(['get_network_request']);

interface Mcp {
  initialize(): Promise<void>;
  request(method: string, params?: object, timeoutMs?: number): Promise<unknown>;
  close(): Promise<void>;
}

/** Same interface as `StdioMcp`; `initialize` and `close` leave the shared connection open. */
class SharedMcp implements Mcp {
  async initialize() {}
  async close() {}
  request(method: string, params: object = {}, timeoutMs = 30_000) { return send('/call', { method, params, timeoutMs }, timeoutMs + 5_000); }
}

function send(path: string, body: object, timeoutMs = 10_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ socketPath: CHROME_SOCKET, path, method: 'POST', timeout: timeoutMs }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try { const reply = JSON.parse(text); if (reply.error) reject(new Error(reply.error)); else resolve(reply.result); }
        catch { reject(new Error('Invalid shared Chrome session reply')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Shared Chrome session timed out')));
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

async function alive() {
  if (!existsSync(CHROME_SOCKET)) return false;
  try { await send('/status', {}, 3_000); return true; } catch { return false; }
}

/** The shared session when it is running; otherwise a private connection (which makes Chrome prompt again). */
export async function connectChrome(): Promise<Mcp> {
  if (await alive()) return new SharedMcp();
  return new StdioMcp(`${root}node_modules/.bin/chrome-devtools-mcp`, ['--autoConnect', '--no-usage-statistics', '--no-performance-crux'], root);
}

async function serve() {
  const mcp = new StdioMcp(`${root}node_modules/.bin/chrome-devtools-mcp`, ['--autoConnect', '--no-usage-statistics', '--no-performance-crux'], root);
  await mcp.initialize();
  // The first tool call attaches to Chrome; the owner accepts its prompt once. Wait up to 5 minutes for that.
  for (let attempt = 0; ; attempt++) {
    const result = await mcp.request('tools/call', { name: 'list_pages', arguments: {} }, 120_000) as { isError?: boolean };
    if (!result.isError) break;
    if (attempt === 2) { console.log('Chrome did not accept the connection'); await mcp.close(); process.exit(1); }
  }
  const stop = async () => { await mcp.close(); rmSync(CHROME_SOCKET, { force: true }); process.exit(0); };
  mcp.process.on('exit', () => { rmSync(CHROME_SOCKET, { force: true }); console.log('DevTools connection ended'); process.exit(1); });
  rmSync(CHROME_SOCKET, { force: true });
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (req.url === '/status') return res.end(JSON.stringify({ result: 'ready' }));
        if (req.url === '/stop') { res.end(JSON.stringify({ result: 'stopping' })); return void stop(); }
        const { method, params, timeoutMs } = JSON.parse(body);
        res.end(JSON.stringify({ result: await mcp.request(method, params, timeoutMs) }));
      } catch (error) { res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'failed' })); }
    });
  });
  server.listen(CHROME_SOCKET, () => { chmodSync(CHROME_SOCKET, 0o600); console.log('ready'); });
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => void stop());
}

async function main(command: string | undefined, args: string[]) {
  if (command === 'serve') return serve();
  if (command === 'status') { console.log(await alive() ? 'running' : 'stopped'); return; }
  if (command === 'stop') { if (await alive()) await send('/stop', {}); console.log('stopped'); return; }
  if (command === 'start') {
    if (await alive()) { console.log('running'); return; }
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    chmodSync(stateDir, 0o700);
    const log = openSync(logFile, 'w', 0o600);
    spawn(process.execPath, [new URL(import.meta.url).pathname, 'serve'], { detached: true, stdio: ['ignore', log, log] }).unref();
    console.log('Waiting for the owner to click Allow in Chrome (up to 5 minutes)…');
    for (let i = 0; i < 150 && !await alive(); i++) await new Promise(r => setTimeout(r, 2_000));
    console.log(await alive() ? 'running' : `not running; see ${logFile}`);
    if (!await alive()) process.exit(1);
    return;
  }
  if (command === 'call') {
    const [tool, json = '{}'] = args;
    if (!tool) throw new Error('usage: chrome-session call <tool> [json arguments]');
    if (SCRIPT_ONLY_TOOLS.has(tool)) throw new Error(`${tool} output can hold credentials; use it from a script, not the CLI`);
    if (!await alive()) throw new Error('shared Chrome session is not running; run: pnpm chrome-session start');
    const result = await send('/call', { method: 'tools/call', params: { name: tool, arguments: JSON.parse(json) }, timeoutMs: 120_000 }, 125_000) as { isError?: boolean; content?: { text?: string }[] };
    console.log((result.content ?? []).map(part => part.text ?? '').join('\n'));
    if (result.isError) process.exit(1);
    return;
  }
  console.error('usage: pnpm chrome-session start | status | stop | call <tool> [json arguments]');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv[2], process.argv.slice(3));
