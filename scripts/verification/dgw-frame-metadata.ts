export interface DgwFrameMetadata {
  readonly type: number;
  readonly frameBytes: number;
  readonly payloadBytes: number;
  readonly acknowledgementRequired: boolean;
}

/** Research-only classifier; holds at most eight header bytes and emits no payload or IDs. */
export class DgwFrameMetadataReader {
  #header: number[] = [];
  #remaining = 0;
  #frame: DgwFrameMetadata | undefined;
  #failed = false;

  get incomplete(): boolean { return this.#header.length > 0 || this.#remaining > 0; }

  push(bytes: Uint8Array): DgwFrameMetadata[] {
    if (this.#failed) throw new Error('DGW metadata: classifier stopped');
    const frames: DgwFrameMetadata[] = [];
    try {
      let offset = 0;
      while (offset < bytes.length) {
        if (this.#remaining > 0) {
          const skipped = Math.min(this.#remaining, bytes.length - offset);
          this.#remaining -= skipped;
          offset += skipped;
          if (this.#remaining === 0) {
            frames.push(this.#frame!);
            this.#frame = undefined;
          }
          continue;
        }
        this.#header.push(bytes[offset++]!);
        const type = this.#header[0]!;
        let headerBytes: number;
        if ([2, 4, 9, 10].includes(type)) headerBytes = 1;
        else if (type === 14) headerBytes = 3;
        else if (type === 3) headerBytes = 5;
        else if (type === 15) headerBytes = 6;
        else if (type === 12 || type === 13) headerBytes = 8;
        else throw new Error('DGW metadata: unsupported frame type');
        if (this.#header.length < headerBytes) continue;
        const lengthOffset = type === 3 ? 1 : 3;
        const declaredLength = headerBytes >= 5
          ? this.#header[lengthOffset]! + this.#header[lengthOffset + 1]! * 256 + this.#header[lengthOffset + 2]! * 65536
          : 0;
        if ((type === 3 && (declaredLength !== 1 || this.#header[4]! > 4)) ||
            (type === 12 && (declaredLength !== 2 || (this.#header[7]! & 128) !== 0)) ||
            (type === 13 && declaredLength < 2)) {
          throw new Error('DGW metadata: invalid frame length or control field');
        }
        const payloadBytes = type === 15 ? declaredLength : type === 13 ? declaredLength - 2 : 0;
        const frame = { type, frameBytes: headerBytes + payloadBytes, payloadBytes,
          acknowledgementRequired: type === 13 && (this.#header[7]! & 128) !== 0 };
        this.#header = [];
        if (payloadBytes === 0) frames.push(frame);
        else { this.#remaining = payloadBytes; this.#frame = frame; }
      }
      return frames;
    } catch (error) {
      this.#header = [];
      this.#remaining = 0;
      this.#frame = undefined;
      this.#failed = true;
      throw error;
    }
  }

  finish(): void {
    if (this.#failed || this.incomplete) {
      this.#header = [];
      this.#remaining = 0;
      this.#frame = undefined;
      this.#failed = true;
      throw new Error('DGW metadata: incomplete or rejected stream');
    }
  }
}
