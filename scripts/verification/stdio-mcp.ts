import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

/** Bounded JSON-RPC harness for public tool checks; never print server stderr. */
export class StdioMcp {
  readonly process: ChildProcessWithoutNullStreams;
  private nextId = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  constructor(command: string, args: string[], cwd: string) {
    this.process = spawn(command, args, { cwd, stdio: 'pipe' });
    this.process.stderr.resume();
    createInterface({ input: this.process.stdout }).on('line', line => {
      let message: { id?: number; error?: unknown; result?: unknown };
      try { message = JSON.parse(line); } catch { this.fail('Invalid MCP JSON'); return; }
      if (message.id === undefined) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error('MCP request rejected'));
      else pending.resolve(message.result);
    });
    this.process.on('error', () => this.fail('MCP process failed'));
    this.process.on('exit', () => this.fail('MCP process exited'));
    this.process.stdin.on('error', () => this.fail('MCP input closed'));
  }

  private fail(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }

  async request(method: string, params: object = {}, timeoutMs = 30_000): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('MCP request timed out'));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2025-03-26', capabilities: {},
      clientInfo: { name: 'threads-research-verifier', version: '0.0.0' }
    });
    this.process.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }

  async close(): Promise<void> {
    this.fail('MCP client closed');
    if (this.process.exitCode !== null || this.process.signalCode !== null) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => this.process.kill('SIGKILL'), 2_000);
      this.process.once('exit', () => { clearTimeout(timer); resolve(); });
      this.process.stdin.end();
      this.process.kill('SIGTERM');
    });
  }
}
