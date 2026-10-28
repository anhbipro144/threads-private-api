import { randomBytes } from 'node:crypto';
import { parseGraphqlEnvelope, THREADS_GRAPHQL_ENDPOINT, ThreadsAuthRequiredError, type ThreadsReadRequest } from './threads-dm-read.ts';

export interface ThreadsTextSendCapture extends ThreadsReadRequest {
  /** Messaging sender ID from observed message data; it differs from form `av`. */
  readonly senderFbid: string;
}

export interface ThreadsTextSendOptions {
  readonly capture: ThreadsTextSendCapture;
  readonly text: string;
  readonly fetchImpl?: typeof fetch;
}

export interface ThreadsTextSendAcknowledgement {
  readonly messageId: string;
  readonly timestampMs: string;
  readonly offlineThreadingId: string;
}

/** A request was attempted; check receipt and never retry this message. */
export class ThreadsSendOutcomeUnknownError extends Error {
  readonly httpStatus: number | null;
  readonly reconnectRequired: boolean;

  constructor(httpStatus: number | null, reconnectRequired = false) {
    super('Threads send: outcome unknown; check receipt and never retry');
    this.name = 'ThreadsSendOutcomeUnknownError';
    this.httpStatus = httpStatus;
    this.reconnectRequired = reconnectRequired;
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Experimental single attempt in the captured conversation; no retry or storage. */
export class ThreadsTextSendAttempt {
  readonly #body: string;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #thread: string;
  readonly #sender: string;
  readonly #text: string;
  readonly #offlineId: string;
  readonly #fetch: typeof fetch;
  #attempted = false;

  constructor(options: ThreadsTextSendOptions) {
    const form = new URLSearchParams(options.capture.body);
    let variables: unknown;
    try { variables = JSON.parse(form.get('variables') ?? 'null'); }
    catch { throw new Error('Threads send: invalid captured variables'); }
    if (form.getAll('variables').length !== 1 ||
        form.getAll('fb_api_req_friendly_name').length !== 1 ||
        form.get('fb_api_req_friendly_name') !== 'WmiSlideTextMessageMutation' ||
        form.getAll('doc_id').length !== 1 || !/^\d+$/.test(form.get('doc_id') ?? '') ||
        !object(variables) || !nonempty(variables['thread_fbid']) ||
        !object(variables['text_body']) || !nonempty(variables['text_body']['sensitive_string_value']) ||
        !nonempty(variables['offline_threading_id']) || !/^\d+$/.test(variables['offline_threading_id']) ||
        variables['send_silently'] !== false ||
        ['recipient_fbids', 'replied_to_message_id', 'forwarded_message_id', 'mentioned_users', 'logging_data']
          .some(key => variables[key] !== null) ||
        Object.keys(variables).some(key => ![
          'text_body', 'recipient_fbids', 'thread_fbid', 'offline_threading_id',
          'replied_to_message_id', 'forwarded_message_id', 'send_silently', 'mentioned_users', 'logging_data',
        ].includes(key))) {
      throw new Error('Threads send: expected captured plain-text send in an existing conversation');
    }
    if (!nonempty(options.text) || !nonempty(options.capture.senderFbid)) {
      throw new Error('Threads send: nonempty text and observed messaging sender required');
    }
    this.#thread = variables['thread_fbid'];
    this.#sender = options.capture.senderFbid;
    this.#text = options.text;
    // Observed client format: timestamp milliseconds followed by 22 random bits.
    let offlineId: bigint;
    do { offlineId = (BigInt(Date.now()) << 22n) | BigInt(randomBytes(3).readUIntBE(0, 3) & 0x3fffff); }
    while (offlineId.toString() === variables['offline_threading_id']);
    if (offlineId <= 0n || offlineId >= (1n << 63n)) throw new Error('Threads send: invalid local clock');
    this.#offlineId = offlineId.toString();
    variables['text_body'] = { sensitive_string_value: this.#text };
    variables['offline_threading_id'] = this.#offlineId;
    form.set('variables', JSON.stringify(variables));
    this.#body = form.toString();
    this.#headers = { ...options.capture.headers };
    this.#fetch = options.fetchImpl ?? fetch;
  }

  /** Caller must obtain exact sender/recipient/text/count approval before calling. */
  async send(): Promise<ThreadsTextSendAcknowledgement> {
    if (this.#attempted) throw new Error('Threads send: attempt already consumed; never retry');
    this.#attempted = true;
    let status: number | null = null;
    try {
      const response = await this.#fetch(THREADS_GRAPHQL_ENDPOINT, {
        method: 'POST', headers: { ...this.#headers }, body: this.#body,
        redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      status = response.status;
      if (status !== 200) throw new Error();
      const ack = parseGraphqlEnvelope(await response.text())['send_slide_text_message'];
      if (!object(ack) || ack['content_type'] !== 'TEXT' ||
          !nonempty(ack['message_id']) || !nonempty(ack['timestamp_ms'])) throw new Error();
      const echo = ack['as_micg_interface'];
      if (!object(echo) || echo['thread_fbid'] !== this.#thread ||
          echo['sender_fbid'] !== this.#sender || echo['offline_threading_id'] !== this.#offlineId ||
          echo['message_id'] !== ack['message_id'] || echo['timestamp_ms'] !== ack['timestamp_ms'] ||
          !object(echo['content']) || echo['content']['text_body'] !== this.#text) throw new Error();
      return { messageId: ack['message_id'], timestampMs: ack['timestamp_ms'], offlineThreadingId: this.#offlineId };
    } catch (error) {
      // Even a malformed acknowledgement can follow delivery; never expose its body.
      throw new ThreadsSendOutcomeUnknownError(status,
        status === 401 || status === 403 || error instanceof ThreadsAuthRequiredError);
    }
  }
}
