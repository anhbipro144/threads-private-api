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

/** Observed client format: timestamp milliseconds followed by 22 random bits. */
function freshOfflineId(captured: string): string {
  let offlineId: bigint;
  do { offlineId = (BigInt(Date.now()) << 22n) | BigInt(randomBytes(3).readUIntBE(0, 3) & 0x3fffff); }
  while (offlineId.toString() === captured);
  if (offlineId <= 0n || offlineId >= (1n << 63n)) throw new Error('Threads send: invalid local clock');
  return offlineId.toString();
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
    this.#offlineId = freshOfflineId(variables['offline_threading_id']);
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

export const THREADS_UPLOAD_ENDPOINT = 'https://www.threads.com/ajax/mercury/upload.php';
// Page fields observed in the browser's upload query (E17-PHOTO-SEND-20261107); taken from the captured form.
const UPLOAD_QUERY_FIELDS = [
  '__user', '__a', '__req', '__hs', 'dpr', '__ccg', '__rev', '__s', '__hsi', '__dyn', '__csr', '__hsdp',
  '__hblp', '__sjsp', '__comet_req', 'fb_dtsg', 'jazoest', 'lsd', '__spin_r', '__spin_b', '__spin_t', '__crn',
];

export interface ThreadsImageSendOptions {
  /** A `WmiSlideMediaMessageMutation` form for the target conversation, with headers and messaging sender. */
  readonly capture: ThreadsTextSendCapture;
  readonly image: Blob;
  readonly fetchImpl?: typeof fetch;
}

export interface ThreadsImageSendAcknowledgement extends ThreadsTextSendAcknowledgement {
  readonly mediaFbid: string;
}

/** The upload failed before any message request; no message was sent. */
export class ThreadsImageUploadError extends Error {
  readonly httpStatus: number | null;

  constructor(httpStatus: number | null) {
    super('Threads image upload failed; no message was sent');
    this.name = 'ThreadsImageUploadError';
    this.httpStatus = httpStatus;
  }
}

/** Experimental single photo attempt: one upload, then one send; no retry or storage. */
export class ThreadsImageSendAttempt {
  readonly #form: URLSearchParams;
  readonly #variables: Record<string, unknown>;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #uploadHeaders: Readonly<Record<string, string>>;
  readonly #uploadUrl: string;
  readonly #thread: string;
  readonly #sender: string;
  readonly #offlineId: string;
  readonly #image: Blob;
  readonly #fetch: typeof fetch;
  #attempted = false;

  constructor(options: ThreadsImageSendOptions) {
    const form = new URLSearchParams(options.capture.body);
    let variables: unknown;
    try { variables = JSON.parse(form.get('variables') ?? 'null'); }
    catch { throw new Error('Threads send: invalid captured variables'); }
    const media = object(variables) ? variables['media'] : null;
    if (form.getAll('variables').length !== 1 ||
        form.getAll('fb_api_req_friendly_name').length !== 1 ||
        form.get('fb_api_req_friendly_name') !== 'WmiSlideMediaMessageMutation' ||
        form.getAll('doc_id').length !== 1 || !/^\d+$/.test(form.get('doc_id') ?? '') ||
        !object(variables) || !nonempty(variables['thread_fbid']) ||
        !nonempty(variables['offline_threading_id']) || !/^\d+$/.test(variables['offline_threading_id']) ||
        !object(media) || media['attachment_type'] !== 'IMAGE' ||
        Object.keys(media).some(key => !['attachment_type', 'media_fbid'].includes(key)) ||
        variables['replied_to_message_id'] !== null || variables['logging_data'] !== null ||
        Object.keys(variables).some(key => ![
          'thread_fbid', 'offline_threading_id', 'media', 'replied_to_message_id', 'logging_data',
        ].includes(key))) {
      throw new Error('Threads send: expected captured single-image send in an existing conversation');
    }
    if (!(options.image instanceof Blob) || options.image.size === 0 || !nonempty(options.capture.senderFbid)) {
      throw new Error('Threads send: nonempty image and observed messaging sender required');
    }
    const query = new URLSearchParams();
    for (const key of UPLOAD_QUERY_FIELDS) { const value = form.get(key); if (value !== null) query.set(key, value); }
    if (!query.has('fb_dtsg')) throw new Error('Threads send: captured form lacks upload fields');
    this.#uploadUrl = `${THREADS_UPLOAD_ENDPOINT}?${query}`;
    this.#thread = variables['thread_fbid'];
    this.#sender = options.capture.senderFbid;
    this.#offlineId = freshOfflineId(variables['offline_threading_id']);
    this.#form = form;
    this.#variables = { ...variables, offline_threading_id: this.#offlineId };
    this.#headers = { ...options.capture.headers };
    // The upload is multipart; drop the form's content type and GraphQL-only headers.
    this.#uploadHeaders = Object.fromEntries(Object.entries(options.capture.headers)
      .filter(([name]) => !/^(content-type|content-length|x-fb-friendly-name|x-root-field-name|x-graphql-)/i.test(name)));
    this.#image = options.image;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  /** Caller must have approval for this exact photo, sender and recipient before calling. */
  async send(): Promise<ThreadsImageSendAcknowledgement> {
    if (this.#attempted) throw new Error('Threads send: attempt already consumed; never retry');
    this.#attempted = true;
    const mediaFbid = await this.#upload();
    const form = new URLSearchParams(this.#form);
    form.set('variables', JSON.stringify({ ...this.#variables, media: { attachment_type: 'IMAGE', media_fbid: mediaFbid } }));
    let status: number | null = null;
    try {
      const response = await this.#fetch(THREADS_GRAPHQL_ENDPOINT, {
        method: 'POST', headers: { ...this.#headers }, body: form.toString(),
        redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      status = response.status;
      if (status !== 200) throw new Error();
      const ack = parseGraphqlEnvelope(await response.text())['send_slide_media_message'];
      if (!object(ack) || !nonempty(ack['message_id']) || !nonempty(ack['timestamp_ms'])) throw new Error();
      const echo = ack['as_micg_interface'];
      if (!object(echo) || echo['thread_fbid'] !== this.#thread ||
          echo['sender_fbid'] !== this.#sender || echo['offline_threading_id'] !== this.#offlineId ||
          echo['message_id'] !== ack['message_id'] || echo['timestamp_ms'] !== ack['timestamp_ms'] ||
          !object(echo['content']) || !Array.isArray(echo['content']['images']) ||
          echo['content']['images'].length !== 1) throw new Error();
      return { messageId: ack['message_id'], timestampMs: ack['timestamp_ms'], offlineThreadingId: this.#offlineId, mediaFbid };
    } catch (error) {
      throw new ThreadsSendOutcomeUnknownError(status,
        status === 401 || status === 403 || error instanceof ThreadsAuthRequiredError);
    }
  }

  async #upload(): Promise<string> {
    const body = new FormData();
    body.set('farr', this.#image, 'image');
    let status: number | null = null;
    try {
      const response = await this.#fetch(this.#uploadUrl, {
        method: 'POST', headers: { ...this.#uploadHeaders }, body,
        redirect: 'error', signal: AbortSignal.timeout(60_000),
      });
      status = response.status;
      if (status !== 200) throw new Error();
      // Read the ID from the raw text: it is a JSON number that can exceed double precision.
      const text = await response.text();
      const parsed: unknown = JSON.parse(text.replace(/^for\s*\(;;\);\s*/, ''));
      const meta = object(parsed) && object(parsed['payload']) && object(parsed['payload']['metadata'])
        ? parsed['payload']['metadata']['0'] : null;
      const fbid = object(meta) ? /"fbid"\s*:\s*"?(\d+)"?/.exec(text.slice(text.indexOf('"metadata"')))?.[1] : undefined;
      if (!fbid) throw new Error();
      return fbid;
    } catch {
      throw new ThreadsImageUploadError(status);
    }
  }
}
