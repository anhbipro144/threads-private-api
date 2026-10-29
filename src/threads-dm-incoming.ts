import { createHash } from 'node:crypto';
import type { DmMessage } from './threads-dm-read.ts';
import { IncomingFrames, check, object, json, decodeIncomingEnvelope } from './threads-incoming-protocol.ts';

export interface ThreadsIncomingSession {
  readonly url: string;
  readonly cookie: string;
  readonly userAgent: string;
  /** Exact first packets captured from the same browser connection; never rebuild cursors/devices. */
  readonly initialPackets: readonly Uint8Array[];
}
export type ThreadsIncomingState = 'configured' | 'connecting' | 'ready' | 'stopped' | 'failed';
export class ThreadsIncomingError extends Error {
  readonly reason: 'invalid-session' | 'protocol-rejected' | 'reconnect-required' | 'connection-failed' | 'timeout' | 'stopped' | 'callback-failed';
  constructor(reason: ThreadsIncomingError['reason']) {
    super(`Threads incoming: ${reason}`);
    this.name = 'ThreadsIncomingError';
    this.reason = reason;
  }
}
export interface ThreadsIncomingOptions {
  readonly session: ThreadsIncomingSession;
  readonly threadId: string;
  /** Only text messages from threadId are delivered; callback rejection stops the receiver. */
  readonly onMessage: (message: DmMessage) => void | Promise<void>;
  readonly seenMessageIds?: readonly string[];
  readonly socketFactory?: (url: string, options: { headers: Record<string, string> }) => WebSocket;
}

/** One connection, no automatic reconnect or resnapshot. Contains no DM send method. */
export class ThreadsDmIncoming {
  #state: ThreadsIncomingState = 'configured';
  #failure: ThreadsIncomingError | undefined;
  #session: ThreadsIncomingSession | undefined;
  #packets: Buffer[] = [];
  #threadId: string;
  #onMessage: ThreadsIncomingOptions['onMessage'] | undefined;
  #factory: NonNullable<ThreadsIncomingOptions['socketFactory']>;
  #socket: WebSocket | undefined;
  #frames = new IncomingFrames();
  #streamId = 0;
  #initialAck = 0;
  #requestId: unknown;
  #started = false;
  #established = false;
  #acknowledged = false;
  #subscribed = false;
  #lastReceived = 0;
  #seen = new Map<string, string | null>();
  #deadline: ReturnType<typeof setTimeout> | undefined;
  #ping: ReturnType<typeof setInterval> | undefined;
  #ready = Promise.withResolvers<void>();
  #closed = Promise.withResolvers<void>();
  /** Rejects on failure; resolves on an explicit stop. Provider error bodies are never exposed. */
  readonly closed: Promise<void>;

  constructor(options: ThreadsIncomingOptions) {
    this.#threadId = options.threadId;
    this.#onMessage = options.onMessage;
    // Node 24 accepts headers here; the installed DOM constructor declaration omits that overload.
    const NodeSocket = WebSocket as unknown as new (url: string, init: { headers: Record<string, string> }) => WebSocket;
    this.#factory = options.socketFactory ?? ((url, init) => new NodeSocket(url, init));
    this.closed = this.#closed.promise;
    void this.closed.catch(() => {});
    void this.#ready.promise.catch(() => {});
    try {
      check(typeof options.threadId === 'string' && options.threadId.length > 0 && typeof options.onMessage === 'function');
      const session = options.session, url = new URL(session.url);
      check(url.protocol === 'wss:' && url.hostname === 'gateway.threads.com' && url.pathname === '/ws/lightspeed' &&
        !url.port && !url.username && !url.password && !url.hash &&
        url.searchParams.getAll('x-dgw-version').length === 1 && url.searchParams.get('x-dgw-version') === '5' &&
        url.searchParams.get('x-dgw-authtype') === '6:0' && !url.searchParams.has('x-dgw-establish-stream-frame-base64'));
      check(typeof session.cookie === 'string' && session.cookie.includes('=') && !/[\r\n]/.test(session.cookie));
      check(typeof session.userAgent === 'string' && session.userAgent.length > 0 && !/[\r\n]/.test(session.userAgent));
      check(Array.isArray(session.initialPackets) && session.initialPackets.length > 0 && session.initialPackets.length <= 4);
      check(session.initialPackets.every(p => p instanceof Uint8Array) && session.initialPackets.reduce((n, p) => n + p.length, 0) <= 32768);
      this.#packets = session.initialPackets.map(p => Buffer.from(p));
      const decoder = new IncomingFrames(), frames = this.#packets.flatMap(p => decoder.push(p));
      check(!decoder.incomplete && frames.length === 2);
      const [establish, data] = frames;
      check(establish?.type === 15 && data?.type === 13 && data.requiresAck && establish.streamId === data.streamId);
      const parameters = json(establish.payload), envelope = json(data.payload);
      check(object(parameters) && Object.keys(parameters).length === 0 && object(envelope) && envelope['type'] === 2);
      check((typeof envelope['request_id'] === 'string' && envelope['request_id'].length > 0) || Number.isSafeInteger(envelope['request_id']));
      check(typeof envelope['payload'] === 'string');
      const config: unknown = JSON.parse(envelope['payload']);
      check(object(config) && config['database'] === 231 && typeof config['last_applied_cursor'] === 'string');
      this.#streamId = data.streamId!;
      this.#initialAck = data.ackId!;
      this.#requestId = envelope['request_id'];
      const seen = options.seenMessageIds ?? [];
      check(seen.length <= 10000 && seen.every(id => typeof id === 'string' && id.length > 0));
      for (const id of seen) this.#seen.set(id, null);
      this.#session = { url: session.url, cookie: session.cookie, userAgent: session.userAgent, initialPackets: [] };
    } catch {
      this.#packets.forEach(p => p.fill(0));
      throw new ThreadsIncomingError('invalid-session');
    }
  }

  get state(): ThreadsIncomingState { return this.#state; }
  start(): Promise<void> {
    if (this.#state === 'stopped') return Promise.reject(new ThreadsIncomingError('stopped'));
    if (this.#state === 'failed') return Promise.reject(this.#failure!);
    if (this.#state !== 'configured') return this.#ready.promise;
    this.#state = 'connecting';
    try {
      const session = this.#session!;
      this.#socket = this.#factory(session.url, { headers: { cookie: session.cookie,
        origin: 'https://www.threads.com', 'user-agent': session.userAgent } });
      this.#session = undefined;
      this.#socket.binaryType = 'arraybuffer';
      this.#socket.addEventListener('message', this.#message);
      this.#socket.addEventListener('close', this.#close);
      this.#socket.addEventListener('error', this.#error);
      this.#deadline = setTimeout(() => this.#fail('timeout'), 20000);
    } catch { this.#fail('connection-failed'); }
    return this.#ready.promise;
  }

  stop(): void {
    if (this.#state === 'stopped' || this.#state === 'failed') return;
    this.#state = 'stopped';
    this.#cleanup();
    this.#ready.reject(new ThreadsIncomingError('stopped'));
    this.#closed.resolve();
  }
  #fail(reason: ThreadsIncomingError['reason']): void {
    if (this.#state === 'stopped' || this.#state === 'failed') return;
    this.#state = 'failed';
    this.#failure = new ThreadsIncomingError(reason);
    this.#cleanup();
    this.#ready.reject(this.#failure);
    this.#closed.reject(this.#failure);
  }
  #cleanup(): void {
    clearTimeout(this.#deadline); clearInterval(this.#ping);
    this.#session = undefined;
    this.#packets.forEach(p => p.fill(0)); this.#packets = [];
    this.#seen.clear(); this.#frames.clear(); this.#onMessage = undefined;
    const socket = this.#socket; this.#socket = undefined;
    if (socket) {
      socket.removeEventListener('message', this.#message);
      socket.removeEventListener('close', this.#close);
      socket.removeEventListener('error', this.#error);
      try { socket.close(); } catch { /* A local stop must not expose socket errors. */ }
    }
  }
  #error = (): void => { this.#fail('connection-failed'); };
  #close = (event: Event): void => { this.#fail((event as CloseEvent).code === 4003 ? 'reconnect-required' : 'connection-failed'); };
  #send(bytes: Uint8Array): void { this.#socket!.send(Uint8Array.from(bytes)); }
  #maybeReady(): void {
    if (this.#state === 'connecting' && this.#established && this.#acknowledged && this.#subscribed) {
      this.#state = 'ready'; clearTimeout(this.#deadline); this.#ready.resolve();
    }
  }
  #message = (event: Event): void => {
    if (this.#state !== 'connecting' && this.#state !== 'ready') return;
    try {
      const data: unknown = (event as MessageEvent).data;
      check(data instanceof ArrayBuffer);
      this.#lastReceived = Date.now();
      for (const frame of this.#frames.push(new Uint8Array(data))) {
        if (this.#state !== 'connecting' && this.#state !== 'ready') break;
        if (frame.streamId !== undefined) check(frame.streamId === this.#streamId);
        if (frame.type === 4 || frame.type === 14) { this.#fail('reconnect-required'); break; }
        if (frame.type === 9) this.#send(Uint8Array.of(10));
        if (frame.type === 10 && !this.#started) {
          this.#started = true;
          for (const packet of this.#packets) this.#send(packet);
          this.#packets.forEach(p => p.fill(0)); this.#packets = [];
          this.#ping = setInterval(() => {
            try {
              if (Date.now() - this.#lastReceived >= 30000) this.#fail('timeout');
              else this.#send(Uint8Array.of(9));
            } catch { this.#fail('connection-failed'); }
          }, 10000);
        }
        if (frame.type === 15) {
          check(this.#started && !this.#established);
          const result = json(frame.payload);
          if (!object(result) || result['code'] !== 200) { this.#fail('reconnect-required'); break; }
          this.#established = true;
        }
        if (frame.type === 12) { check(this.#started && frame.ackId === this.#initialAck); this.#acknowledged = true; }
        if (frame.type === 13) {
          check(this.#established);
          if (frame.requiresAck) this.#send(Uint8Array.from([12, this.#streamId & 255, this.#streamId >> 8, 2, 0, 0, frame.ackId! & 255, frame.ackId! >> 8]));
          const envelope = decodeIncomingEnvelope(frame.payload, this.#threadId);
          if (envelope.resetRequired) { this.#fail('reconnect-required'); break; }
          if (envelope.subscribed) {
            check(!this.#subscribed && envelope.requestId === this.#requestId);
            this.#subscribed = true;
          }
          this.#maybeReady();
          check(envelope.messages.length === 0 || this.#state === 'ready');
          for (const message of envelope.messages) {
            if (this.#state !== 'ready') break;
            const digest = createHash('sha256').update(JSON.stringify(message)).digest('hex');
            if (this.#seen.has(message.messageId)) {
              const previous = this.#seen.get(message.messageId);
              check(previous === null || previous === digest);
              continue;
            }
            check(this.#seen.size < 10000);
            this.#seen.set(message.messageId, digest);
            try {
              void Promise.resolve(this.#onMessage!(message)).catch(() => this.#fail('callback-failed'));
            } catch { this.#fail('callback-failed'); break; }
          }
        }
        this.#maybeReady();
      }
    } catch { this.#fail('protocol-rejected'); }
  };
}
