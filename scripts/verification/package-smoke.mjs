import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const output = join(root, '.artifacts');
const work = mkdtempSync(join(tmpdir(), 'threads-package-'));
const consumer = join(work, 'consumer');
const env = { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH,
  npm_config_cache: join(work, 'npm-cache'), npm_config_update_notifier: 'false' };
delete env.NODE_PATH;
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  mkdirSync(output, { recursive: true });
  const packedText = run('npm', ['pack', '--json', '--pack-destination', output]);
  const [packed] = JSON.parse(packedText.slice(packedText.indexOf('[\n')));
  assert.equal(packed.version, manifest.version);
  const archive = join(output, packed.filename);
  const entries = run('tar', ['-tzf', archive]).trim().split('\n').map(p => p.replace(/^package\//, '')).sort();
  assert.deepEqual(entries, packed.files.map(f => f.path).sort());
  const compiled = new Set(readdirSync(join(root, 'src')).filter(f => f.endsWith('.ts')).flatMap(f => [
    'dist/' + f.replace(/\.ts$/, '.js'), 'dist/' + f.replace(/\.ts$/, '.d.ts'),
  ]));
  const allowed = path => path === 'package.json' || compiled.has(path) || manifest.files.some(p =>
    p !== 'dist' && (path === p || (['docs/usage-guide', 'examples'].includes(p) && path.startsWith(p + '/') && /\.(md|mjs)$/.test(path))));
  for (const entry of entries) assert(allowed(entry), 'Unexpected bundled path: ' + entry);
  for (const entry of compiled) assert(entries.includes(entry), 'Missing compiled file: ' + entry);
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'isolated-consumer', private: true, type: 'module' }));
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', archive], consumer);
  const installed = join(consumer, 'node_modules', manifest.name);
  const shipped = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(shipped.version, manifest.version);
  assert.equal(Object.keys(shipped.dependencies ?? {}).length, 0);
  assert.equal(Object.keys(shipped.optionalDependencies ?? {}).length, 0);
  assert(!readdirSync(join(consumer, 'node_modules')).some(p => /chrome|rea-agents|typescript|^node$/.test(p)));
  for (const entry of entries.filter(p => /\.(js|mjs|json|md|ts)$/.test(p))) {
    const text = readFileSync(join(installed, entry), 'utf8');
    assert(!/sessionid\s*=[^\s'";]+|csrftoken\s*=[^\s'";]+|https:\/\/www\.threads\.com\/messages\/t\/[0-9]+/i.test(text), 'Private-value candidate in: ' + entry);
  }
  const tests = readdirSync(join(root, 'tests/unit')).filter(p => p.startsWith('threads') && p.endsWith('.test.ts'));
  const testsDir = join(consumer, 'tests'); mkdirSync(testsDir);
  for (const test of tests) {
    const source = readFileSync(join(root, 'tests/unit', test), 'utf8').replace(/\.\.\/\.\.\/src\/([a-z-]+)\.ts/g,
      (_match, name) => pathToFileURL(join(installed, 'dist', name + '.js')).href);
    writeFileSync(join(testsDir, test), source);
  }
  const testResult = run(process.execPath, ['--test', ...tests.map(p => join(testsDir, p))], consumer);
  assert(!testResult.includes('ℹ fail 1'));
  const demo = JSON.parse(run(process.execPath, [join(installed, 'examples/offline-demo.mjs')], consumer));
  assert.deepEqual(demo, { conversations: 1, messages: 1, liveRequests: 0, messagesSent: 0 });
  writeFileSync(join(consumer, 'consumer.mts'), `import { ThreadsDmReader, ThreadsDmIncoming, ThreadsTextSendAttempt, createThreadsReadHandler, createThreadsSendHandler, createFileThreadsSendJournal, type DmMessage, type ThreadsIncomingSession } from 'threads-private-api';
const api = [ThreadsDmReader, ThreadsDmIncoming, ThreadsTextSendAttempt, createThreadsReadHandler, createThreadsSendHandler, createFileThreadsSendJournal];
const message: DmMessage = {messageId:'synthetic',threadFbid:'synthetic',senderFbid:'synthetic',timestampMs:'1',content:'synthetic'};
const incoming: ThreadsIncomingSession = {url:'wss://example.invalid',cookie:'synthetic=value',userAgent:'synthetic',initialPackets:[]};
void api; void message; void incoming;
`);
  run(process.execPath, [join(root, 'node_modules/typescript/lib/tsc.js'), '--noEmit', '--strict', '--target', 'ES2024', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'node', '--typeRoots', join(root, 'node_modules/@types'), 'consumer.mts'], consumer);
  const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(join(output, 'SHA256SUMS'), checksum + '  ' + packed.filename + '\n');
  console.log(JSON.stringify({ package: packed.filename, files: entries.length, runtimeDependencies: 0,
    installedTests: testResult.split('\n').find(l => /tests [0-9]+/.test(l))?.trim(),
    javascriptConsumer: 'passed', typescriptConsumer: 'passed', offlineExample: 'passed', sha256: checksum }));
} catch (error) {
  console.error('Package validation failed.');
  if (error.stdout) console.error(String(error.stdout).slice(-6000));
  if (error.stderr) console.error(String(error.stderr).slice(-3000));
  if (!error.stdout && !error.stderr) console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
