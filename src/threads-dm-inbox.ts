import { ThreadsDmIncoming, ThreadsIncomingError, type ThreadsIncomingOptions, type ThreadsIncomingSession } from './threads-dm-incoming.ts';

export type ThreadsInboxState = 'connecting' | 'live' | 'reconnecting' | 'needs-owner' | 'stopped' | 'failed';

export interface ThreadsDmInboxOptions extends Omit<ThreadsIncomingOptions, 'session'> {
  /**
   * Supplies setup for each connection: stored packets or a fresh capture from the owner's
   * browser. Which one works after a drop is open (E19). `undefined` means the owner must act.
   */
  readonly getSession: () => Promise<ThreadsIncomingSession | undefined>;
  /** Runs after every reconnect while live delivery continues, e.g. a bounded read of recent chats. */
  readonly reconcile?: () => Promise<void>;
  readonly onState?: (state: ThreadsInboxState, error?: ThreadsIncomingError) => void;
  /** Consecutive attempts that never reach live before `needs-owner`. Default 5. */
  readonly maxAttempts?: number;
  /** Backoff cap; delays double from 1 s. Default 60 s. */
  readonly maxBackoffMs?: number;
}

// Drops worth another connection; anything else is a host or protocol problem.
const RETRYABLE = new Set<ThreadsIncomingError['reason']>(['reconnect-required', 'connection-failed', 'timeout']);

/** One live receiver at a time, replaced after drops with capped backoff. Delivery is at-least-once. */
export class ThreadsDmInbox {
  #options: ThreadsDmInboxOptions;
  #state: ThreadsInboxState = 'connecting';
  #receiver: ThreadsDmIncoming | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #wake: (() => void) | undefined;
  #started = false;
  // Stored setup packets replay everything since capture (E19-DROP-RECONNECT-20261108), so skip what was delivered.
  #seen: Set<string>;
  #closed = Promise.withResolvers<void>();
  /** Resolves on stop; rejects with the last error on `failed` or `needs-owner`. */
  readonly closed: Promise<void>;

  constructor(options: ThreadsDmInboxOptions) {
    if (typeof options.getSession !== 'function') throw new TypeError('Threads inbox: getSession is required');
    this.#options = options;
    this.#seen = new Set(options.seenMessageIds);
    this.closed = this.#closed.promise;
    void this.closed.catch(() => {});
  }

  get state(): ThreadsInboxState { return this.#state; }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    void this.#run();
  }

  stop(): void {
    if (this.#ended()) return;
    this.#set('stopped');
    clearTimeout(this.#timer); this.#wake?.();
    this.#receiver?.stop();
    this.#closed.resolve();
  }

  #ended(): boolean { return this.#state === 'stopped' || this.#state === 'failed' || this.#state === 'needs-owner'; }
  #set(state: ThreadsInboxState, error?: ThreadsIncomingError): void {
    this.#state = state;
    try { this.#options.onState?.(state, error); } catch { /* State reports must not break delivery. */ }
  }
  #end(state: 'failed' | 'needs-owner', error: ThreadsIncomingError): void {
    this.#set(state, error);
    this.#closed.reject(error);
  }
  #sleep(ms: number): Promise<void> {
    return new Promise(resolve => { this.#wake = resolve; this.#timer = setTimeout(resolve, ms); });
  }

  async #run(): Promise<void> {
    const { maxAttempts = 5, maxBackoffMs = 60_000 } = this.#options;
    let failures = 0, connectedBefore = false;
    while (!this.#ended()) {
      let error: ThreadsIncomingError, liveAt = 0;
      try {
        const session = await this.#options.getSession();
        if (this.#ended()) return;
        if (!session) { this.#end('needs-owner', new ThreadsIncomingError('invalid-session')); return; }
        const { onMessage, onChange, threadId, socketFactory } = this.#options;
        const receiver = this.#receiver = new ThreadsDmIncoming({ session, seenMessageIds: [...this.#seen],
          onMessage: async message => {
            await onMessage(message);
            this.#seen.add(message.messageId);
            if (this.#seen.size > 10000) this.#seen.delete(this.#seen.values().next().value!);
          },
          ...(onChange ? { onChange } : {}), ...(threadId ? { threadId } : {}), ...(socketFactory ? { socketFactory } : {}) });
        await receiver.start();
        if (this.#ended()) { receiver.stop(); return; }
        if (connectedBefore) await this.#options.reconcile?.();
        connectedBefore = true;
        if (this.#ended()) return;
        this.#set('live'); liveAt = Date.now();
        await receiver.closed;
        return;
      } catch (caught) {
        if (this.#ended()) return;
        error = caught instanceof ThreadsIncomingError ? caught : new ThreadsIncomingError('connection-failed');
        // A reconcile failure is the host's; it must not look like a dropped connection.
        if (!(caught instanceof ThreadsIncomingError) && this.#receiver?.state === 'ready') {
          this.#receiver.stop(); this.#end('failed', new ThreadsIncomingError('callback-failed')); return;
        }
      }
      // Only a connection that stayed up a minute resets the count, so a flapping session still ends.
      if (liveAt && Date.now() - liveAt >= 60_000) failures = 0;
      if (error.reason === 'invalid-session') { this.#end('needs-owner', error); return; }
      if (!RETRYABLE.has(error.reason)) { this.#end('failed', error); return; }
      if (++failures >= maxAttempts) { this.#end('needs-owner', error); return; }
      this.#set('reconnecting', error);
      await this.#sleep(Math.min(maxBackoffMs, 1000 * 2 ** (failures - 1)));
    }
  }
}
