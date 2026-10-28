import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createFileThreadsSendJournal } from '../../src/index.ts';

test('claims and minimal outcomes survive reopening without private data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'threads-journal-'));
  try {
    const directory = join(root, 'journal'), id = randomUUID();
    const journal = await createFileThreadsSendJournal(directory);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal(await journal.claim(id), true);
    assert.equal(await journal.claim(id), false);
    assert.equal((await stat(join(directory, id + '.state'))).mode & 0o777, 0o600);
    const reopened = await createFileThreadsSendJournal(directory);
    assert.equal(await reopened.get(id), 'attempted');
    assert.equal(await reopened.claim(id), false);
    await journal.complete(id, 'acknowledged');
    assert.equal(await reopened.get(id), 'acknowledged');
    assert.equal(await readFile(join(directory, id + '.state'), 'utf8'), 'acknowledged\n');
    assert.deepEqual(await readdir(directory), [id + '.state']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('partial claims stay consumed and corrupt statuses fail closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'threads-journal-'));
  try {
    const journal = await createFileThreadsSendJournal(root);
    for (const value of ['', 'partially written']) {
      const id = randomUUID();
      await writeFile(join(root, id + '.state'), value, { mode: 0o600 });
      assert.equal(await journal.claim(id), false);
      assert.equal(await journal.get(id), 'unknown');
    }
    assert.equal(await journal.get('../../escape'), null);
    await assert.rejects(journal.claim('../../escape'), /private storage unavailable/);
    await assert.rejects(journal.complete('../../escape', 'unknown'), /private storage unavailable/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('unsafe permissions and symlinks are refused without disclosing paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'threads-journal-'));
  try {
    await chmod(root, 0o777);
    await assert.rejects(createFileThreadsSendJournal(root), /private storage unavailable/);
    await chmod(root, 0o700);
    const directory = join(root, 'journal'), journal = await createFileThreadsSendJournal(directory);
    const id = randomUUID();
    await journal.claim(id);
    await chmod(join(directory, id + '.state'), 0o644);
    await assert.rejects(journal.get(id), error => !String(error).includes(root));
    const link = join(root, 'linked-journal');
    await symlink(directory, link);
    await assert.rejects(createFileThreadsSendJournal(link), /private storage unavailable/);
    const linkedId = randomUUID();
    await symlink(join(directory, id + '.state'), join(directory, linkedId + '.state'));
    await assert.rejects(journal.get(linkedId), /private storage unavailable/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('independent processes atomically claim once; an exited process leaves a recoverable guard', async () => {
  const root = await mkdtemp(join(tmpdir(), 'threads-journal-'));
  try {
    const directory = join(root, 'journal'), id = randomUUID();
    await createFileThreadsSendJournal(directory);
    const moduleUrl = new URL('../../src/threads-send-journal.ts', import.meta.url).href;
    const code = `import {createFileThreadsSendJournal} from ${JSON.stringify(moduleUrl)};
      const journal=await createFileThreadsSendJournal(process.argv[1]);
      console.log(await journal.claim(process.argv[2]));`;
    const run = () => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', code, directory, id], { stdio: ['ignore', 'pipe', 'ignore'] });
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.on('error', reject);
      child.on('exit', status => status === 0 ? resolve(output.trim()) : reject(new Error('Journal child failed')));
    });
    assert.deepEqual((await Promise.all([run(), run()])).sort(), ['false', 'true']);
    const afterExit = await createFileThreadsSendJournal(directory);
    assert.equal(await afterExit.get(id), 'attempted');
    assert.equal(await afterExit.claim(id), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
