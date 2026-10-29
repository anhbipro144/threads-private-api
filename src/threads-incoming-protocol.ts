import { parseMessageList, type DmMessage } from './threads-dm-read.ts';

// Local resource limits for this text-only receiver, not platform limits.
export const MAX_INCOMING_BYTES = 1024 * 1024;
export function check(value: unknown): asserts value {
  if (!value) throw new Error('Threads incoming: invalid protocol data');
}
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function json(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export interface IncomingFrame {
  readonly type: number;
  readonly streamId: number | undefined;
  readonly ackId: number | undefined;
  readonly requiresAck: boolean;
  readonly payload: Buffer;
}

/** Version-5 frames observed in E5-NODE-PUSH-20261029. */
export class IncomingFrames {
  #pending: Buffer = Buffer.alloc(0);
  get incomplete(): boolean { return this.#pending.length !== 0; }
  clear(): void { this.#pending = Buffer.alloc(0); }
  push(chunk: Uint8Array): IncomingFrame[] {
    check(this.#pending.length + chunk.length <= MAX_INCOMING_BYTES * 2);
    this.#pending = Buffer.concat([this.#pending, chunk]);
    const frames: IncomingFrame[] = [];
    while (this.#pending.length) {
      const type = this.#pending[0]!;
      let size: number, offset = 1;
      if ([2, 4, 9, 10].includes(type)) size = 1;
      else if (type === 14) { size = 3; offset = 3; }
      else {
        check([12, 13, 15].includes(type));
        if (this.#pending.length < 6) break;
        size = 6 + this.#pending.readUIntLE(3, 3);
        offset = type === 15 ? 6 : 8;
        check(size <= MAX_INCOMING_BYTES && size >= offset);
        if (type === 12) check(size === 8);
      }
      if (this.#pending.length < size) break;
      const bytes = this.#pending.subarray(0, size);
      const streamId = [12, 13, 14, 15].includes(type) ? bytes.readUInt16LE(1) : undefined;
      const ackField = [12, 13].includes(type) ? bytes.readUInt16LE(6) : undefined;
      if (type === 12) check(ackField! < 32768);
      frames.push({ type, streamId, ackId: ackField === undefined ? undefined : ackField & 32767,
        requiresAck: type === 13 && (ackField! & 32768) !== 0, payload: bytes.subarray(offset) });
      check(frames.length <= 4096);
      this.#pending = this.#pending.subarray(size);
    }
    return frames;
  }
}

interface Field { id: number; wire: number; value: bigint | Buffer }
function fields(bytes: Buffer): Field[] {
  let offset = 0;
  const result: Field[] = [];
  const varint = (): bigint => {
    let value = 0n;
    for (let i = 0; i < 10; i++) {
      check(offset < bytes.length);
      const byte = bytes[offset++]!;
      check(i < 9 || byte < 2);
      value |= BigInt(byte & 127) << BigInt(i * 7);
      if ((byte & 128) === 0) return value;
    }
    throw new Error('Threads incoming: invalid varint');
  };
  while (offset < bytes.length) {
    const tag = varint(), id = Number(tag >> 3n), wire = Number(tag & 7n);
    check(id > 0 && id <= 536870911);
    let value: bigint | Buffer;
    if (wire === 0) value = varint();
    else {
      check([1, 2, 5].includes(wire));
      const length = wire === 2 ? Number(varint()) : wire === 1 ? 8 : 4;
      check(Number.isSafeInteger(length) && length >= 0 && offset + length <= bytes.length);
      value = bytes.subarray(offset, offset + length);
      offset += length;
    }
    result.push({ id, wire, value });
    check(result.length <= 4096);
  }
  return result;
}
function single(values: Field[], id: number, wire: number): Field | undefined {
  const matches = values.filter(f => f.id === id);
  check(matches.length <= 1 && matches.every(f => f.wire === wire));
  return matches[0];
}

export interface IncomingEnvelope {
  readonly requestId: unknown;
  readonly subscribed: boolean;
  readonly resetRequired: boolean;
  readonly messages: readonly DmMessage[];
}

export function decodeIncomingEnvelope(bytes: Buffer, threadId: string): IncomingEnvelope {
  const envelope = json(bytes);
  check(object(envelope));
  const result = { requestId: envelope['request_id'], subscribed: false, resetRequired: false, messages: [] as DmMessage[] };
  if (envelope['error_code'] != null && envelope['error_code'] !== 0) {
    check(typeof envelope['error_code'] === 'number');
    return { ...result, resetRequired: true };
  }
  const encoded = envelope['payload'];
  if (encoded == null) return result;
  check(typeof encoded === 'string' && encoded.length <= MAX_INCOMING_BYTES && /^[A-Za-z0-9+/]*={0,2}$/.test(encoded));
  const decoded = Buffer.from(encoded, 'base64');
  check(decoded.toString('base64') === encoded);
  const root = fields(decoded);
  single(root, 1, 2); single(root, 3, 2);
  for (const field of root.filter(f => f.id === 2)) {
    check(field.wire === 2 && Buffer.isBuffer(field.value));
    const operations = fields(field.value).filter(f => f.id >= 1 && f.id <= 5);
    check(operations.length === 1);
    const op = operations[0]!;
    check(op.wire === 2 && Buffer.isBuffer(op.value));
    const body = fields(op.value);
    if (op.id === 1) {
      single(body, 1, 0); single(body, 2, 0); single(body, 3, 0);
      check(!result.subscribed);
      result.subscribed = true;
    } else if (op.id === 2 || op.id === 5) result.resetRequired = true;
    else if (op.id === 3) {
      single(body, 1, 0);
      const delta = single(body, 2, 2);
      check(delta && Buffer.isBuffer(delta.value));
      const data = json(delta.value);
      check(object(data) && object(data['data']));
      const entries = data['data']['slide_delta_processor'];
      check(Array.isArray(entries) && entries.length <= 4096);
      for (const entry of entries) {
        check(object(entry));
        if (entry['__typename'] !== 'SlideUQPPNewMessage' || entry['thread_fbid'] !== threadId) continue;
        check(object(entry['message']) && object(entry['message']['as_micg_interface']));
        check(entry['message']['as_micg_interface']['thread_fbid'] === threadId);
        result.messages.push(...parseMessageList({ get_slide_thread: {
          messages: { edges: [{ node: entry['message'] }] },
        } }, threadId).messages);
      }
    }
  }
  return result;
}
