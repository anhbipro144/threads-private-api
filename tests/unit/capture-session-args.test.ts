import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

// Invalid arguments must exit before the capture can attach to Chrome.
test('capture usage and argument checks work with and without the send step', () => {
  for (const args of [
    [], ['--username', 'synthetic-shop'],
    ['--username', 'shop', '--out', '/unused/synthetic-session.json', '--with-send'],
    ['--username', 'shop', '--out', '/unused/synthetic-session.json', '--thread', 'invalid'],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/capture-session.ts', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^usage: pnpm capture-session .*\[--with-send \(requires --thread\)\]/);
    assert(!result.stderr.includes('synthetic-session'));
  }
});
