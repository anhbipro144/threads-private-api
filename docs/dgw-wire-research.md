# DGW connection and frame research — 2026-10-28

Static continuation after `c7edfe9`. These are **HYPOTHESIS** for the active
service contract unless corroborated below, derived from inert public client source. No new browser
connection, subscription, message send or provider request was made in this
static continuation. Later runtime evidence is recorded immediately below.

2026-10-29 preparation: the source-derived metadata classifier now lives at
`scripts/verification/dgw-frame-metadata.ts`, outside the SDK exports/build.
It skips payload bytes, emits no identifiers, handles fragmented/concatenated
frames and stops on unsupported or malformed data. Its synthetic tests do not
establish live compatibility. Typecheck, 56 tests and build passed.

2026-10-29 runtime follow-up: owner enablement restored autoConnect. The metadata
checker recognized establish/data/ack/ping/pong frames without rejection or
unfinished data in the bounded check. A private Node research receiver then
replayed the exact captured subscription with fresh in-memory session values,
received an accepted stream/subscription, and decoded one new controlled incoming
message. It matched a separate Node read after DevTools disconnected and its
owned browser tab closed. This **REPRODUCES** one standalone incoming push;
it does not validate every source-derived branch below. Current state, consumed
test authorization and shutdown caveat: `docs/agent-handoff.md`,
E5-NODE-PUSH-20261029 in `docs/experiments.md`. Prototype stopped. SDK extraction
is now implemented with 66 passing synthetic tests and typecheck/build. Its
separate E5-SDK-PUSH-20261029 live check received one controlled message, with one
callback matching a separate Node read. Long-running reconnect/expiry/provider
deduplication reliability remains unfinished.

## Connection construction

`DGWEnvUtil` maps Threads to `gateway.threads.com`, auth type `INSTAGRAM`, a
`wss` endpoint with `/ws`, and `DGWVER_BIG_IDS` (5). `DGWAuth` maps `INSTAGRAM`
to `6:0`. `DGWUtils.constructConnectUrl` appends the service name, giving the
public structural path `/ws/lightspeed` for this stream. This agrees with the
path filter used during the earlier metadata observation; it does not establish
the necessary authentication/session values for a Node handshake.

Connection parameters are URL query fields, despite the source naming them
headers: `x-dgw-appid`, `x-dgw-appversion`, `x-dgw-authtype`, `x-dgw-version`,
`x-dgw-uuid`, plus configured device/logging/region/tier fields. App-specific
headers are prefixed with `x-dgw-app-`. The generic constructor can include an
`Authorization` parameter for token-based modes; the ordinary Threads branch
does not itself supply a token. Do not infer cookie requirements from this.
App/account/device identifiers and version must come from actual owner state,
not static constants or invented values. Never log the completed private URL.

An optional first establish frame is encoded as URL-safe base64 in
`x-dgw-establish-stream-frame-base64`. The constructor removes this field if the
URL exceeds 2000 characters, leaving stream establishment to the later path.
Only actual observation can identify which branch the current browser uses.

## Binary framing before the Lightspeed payload

`DGWWebSocketTransport` sets `binaryType = "arraybuffer"`.
`StreamGroupWebSocketTransport` passes bytes into `DGWCodec`, which buffers
partial data and dispatches zero or more complete frames. One WebSocket message
must not be assumed to contain exactly one protocol frame.

`DGWCodec` calls `DGWCppBridge` exports. Although the wrapper retains Emscripten
names and `dgwcppbridge.wasm` strings, this artifact contains a JavaScript
implementation behind a local `S.Instance`/`S.instantiate` shim. A separate
downloaded WASM file has not been shown necessary. Nothing was executed here.

The version-5 encoder/decoder bodies establish these static candidates:

| Type byte | Kind | Remaining bytes |
| --- | --- | --- |
| 2 | Empty | None |
| 4 | Deauth | None |
| 9 / 10 | Ping / Pong | None |
| 15 | Establish stream | uint16 little-endian stream ID, uint24 little-endian payload length, payload |
| 13 | Stream data | uint16 little-endian stream ID, uint24 little-endian length, uint16 acknowledgement field, payload |
| 12 | Stream acknowledgement | uint16 little-endian stream ID, uint24 little-endian length of 2, uint16 acknowledgement field |
| 14 | End of data | uint16 little-endian stream ID |

For type 13 the length includes the two acknowledgement bytes. Bit 15 of the
acknowledgement field requests an acknowledgement; lower 15 bits carry its ID.
The encoder limits acknowledged IDs to 32767. `GroupedStream` currently cycles
outgoing IDs modulo 128 and sends an acknowledgement before delivering received
data to its application callback. These are transport acknowledgements, not DM
delivery acknowledgements. Type 3 drain and legacy frame types exist; this table
is not a complete decoder specification and must not be used to skip unknowns.

The 19 one-byte frames in E5 cannot yet be called pongs: the observer retained
sizes, not byte values. The larger frames cannot be called message payloads
without scoped decoding. No original frame body is available for replay.

## Initial subscription and application decoding

`WmiDGWLightspeedStream` selects service `lightspeed`, the configured device ID
or the current client device ID, 8000 ms connection timeout and 10000 ms
keepalive. It UTF-8 encodes the result of its configuration callback and calls
`establishStream(..., bytes, true)`. `GroupedStream.sendFrame` can concatenate
the establish frame and initial acknowledged data in one WebSocket send.
Later `publish` serializes application objects as UTF-8 JSON inside data frames.

The receive path strips the DGW frame before passing application bytes to the
topic handlers. Only then does the JSON envelope → base64 → LSResponse protobuf
→ delta JSON sequence in [incoming-research.md](incoming-research.md) apply.
Decoding raw WebSocket bytes directly as that envelope would miss this layer.

Still required before a receiver: actual handshake branch and required session
fields; actual initial configuration and valid sequence/device state; bounded
frame validation; scope filtering before retaining message content; provider
rejections, acknowledgement timing, reconnect and deduplication behavior.
Static source does not establish any of these server acceptance properties.

The next bounded runtime step is metadata-only frame classification in an owned
observation tab: retain direction, type, declared/available lengths and partial
frame counts, never query values or payload bodies. Do not request another
message until a scoped decoder/check is ready. A fresh live send still needs
its own exact approval; the previous incoming observation is consumed.

## Provenance and coverage

Public source `/private/tmp/threads-send-static-r6fGHk/def-06b88eedd229.js`,
SHA-256 `06b88eedd229a27a5a5d629b40fd8a40ac019ffac70973e3ce280824262e26d6`.
Current REA parent:
`ev_ac6d16f928a8bb0f01e0d390de26d69626876fd80b5ebf7cb015e1b19243b105`;
summary `ev_f02329c0f9ab6225a84cd41b8a47646ba7accb4067338a06e917aebc24e2d362`.
An earlier retained parent was unavailable in the current server, so the
single selected source was analyzed again. Syntax parsed successfully; 12
inventoried files were unselected, semantic node/unknown and alias bounds were
reached, and `__d` module identities were not recovered. No complete graph or
dynamic execution claim follows. Direct inert text/TypeScript AST checks supplied
the narrow facts above; neither method executed the downloaded module.

Offsets below are JavaScript string offsets in that source:

| Module | Offset |
| --- | ---: |
| DGWConstants | 2137819 |
| DGWEnvUtil | 2142946 |
| DGWCppBridge | 2473778 |
| DGWUtils | 2509700 |
| DGWWebSocketTransport | 2529925 |
| GroupedStream | 2532900 |
| StreamGroupWebSocketTransport | 2539130 |
| RawDGWClient / DGWClient | 2560666 / 2562107 |
| WmiDGWLightspeedStream | 2772007 |

Within `DGWCppBridge`, the export map ties `asm.o` to decoder `x` (relative
offset 5307), `asm.i` to establish encoder `N` (15743), `asm.k` to data encoder
`P` (14316), `asm.l` to acknowledgement encoder `w` (17646), `asm.j` to end encoder
`U` (22408), and `asm.m`/`asm.n` to ping `K` (24395)/pong `Q` (24665).
