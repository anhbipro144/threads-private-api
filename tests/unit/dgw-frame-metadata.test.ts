import assert from 'node:assert/strict';
import test from 'node:test';
import { DgwFrameMetadataReader } from '../../scripts/verification/dgw-frame-metadata.ts';

// Invented byte sequences from the source-derived layout; no live payloads.
const bytes = Uint8Array.from([
  10,
  15, 1, 0, 2, 0, 0, 123, 125,
  13, 1, 0, 5, 0, 0, 7, 128, 65, 66, 67,
  12, 1, 0, 2, 0, 0, 7, 0,
  14, 1, 0,
  3, 1, 0, 0, 4,
  9, 2, 4,
]);

test('metadata classification is unchanged at every fragmentation boundary', () => {
  const expected = new DgwFrameMetadataReader().push(bytes);
  assert.deepEqual(expected.slice(0, 3), [
    { type: 10, frameBytes: 1, payloadBytes: 0, acknowledgementRequired: false },
    { type: 15, frameBytes: 8, payloadBytes: 2, acknowledgementRequired: false },
    { type: 13, frameBytes: 11, payloadBytes: 3, acknowledgementRequired: true },
  ]);
  for (let split = 0; split <= bytes.length; split++) {
    const reader = new DgwFrameMetadataReader();
    assert.deepEqual([...reader.push(bytes.slice(0, split)), ...reader.push(bytes.slice(split))], expected);
    reader.finish();
    assert.equal(reader.incomplete, false);
  }
  const reader = new DgwFrameMetadataReader();
  assert.deepEqual(Array.from(bytes).flatMap(byte => reader.push(Uint8Array.of(byte))), expected);
  reader.finish();
  assert(!JSON.stringify(expected).includes('ABC'));
  assert.deepEqual(Object.keys(expected[2]!), ['type', 'frameBytes', 'payloadBytes', 'acknowledgementRequired']);
});

test('incomplete, malformed and unsupported frames fail with value-free errors', () => {
  for (const input of [[1], [5], [13, 0, 0, 1, 0, 0, 0, 0],
    [12, 0, 0, 3, 0, 0, 0, 0], [12, 0, 0, 2, 0, 0, 0, 128], [3, 2, 0, 0, 1], [3, 1, 0, 0, 5]]) {
    const reader = new DgwFrameMetadataReader();
    assert.throws(() => reader.push(Uint8Array.from(input)), /^Error: DGW metadata:/);
    assert.throws(() => reader.push(Uint8Array.of(10)), /classifier stopped/);
  }
  for (const input of [[15, 0], [13, 0, 0, 3, 0, 0, 0, 0], [15, 0, 0, 1, 0, 0]]) {
    const reader = new DgwFrameMetadataReader();
    assert.deepEqual(reader.push(Uint8Array.from(input)), []);
    assert.equal(reader.incomplete, true);
    assert.throws(() => reader.finish(), /incomplete/);
  }
});
