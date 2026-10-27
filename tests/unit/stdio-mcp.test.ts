import assert from 'node:assert/strict';
import test from 'node:test';
import { StdioMcp } from '../../scripts/verification/stdio-mcp.ts';

const fixture = `
const rl = require('node:readline').createInterface({input: process.stdin});
rl.on('line', line => {
  const m = JSON.parse(line);
  if (m.method === 'hang' || m.id === undefined) return;
  if (m.method === 'crash') process.exit(1);
  const reply = m.method === 'reject' ? {error: {code: -1}} : {result: {method: m.method}};
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,...reply})+'\\n');
});`;

test('MCP correlates concurrent responses and handles errors, timeout, and exit', async () => {
  const client = new StdioMcp(process.execPath, ['-e', fixture], process.cwd());
  try {
    await client.initialize();
    assert.deepEqual(await Promise.all([client.request('one'), client.request('two')]),
      [{ method: 'one' }, { method: 'two' }]);
    await assert.rejects(client.request('reject'), /rejected/);
    await assert.rejects(client.request('hang', {}, 25), /timed out/);
    await assert.rejects(client.request('crash'), /exited/);
  } finally { await client.close(); }
});
