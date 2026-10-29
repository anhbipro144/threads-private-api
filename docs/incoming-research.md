# Incoming-message investigation

Investigation after commit `91393b4`. A private Node research receiver reproduced
one incoming push on 2026-10-29. `ThreadsDmIncoming` is now extracted/exported with
66 passing synthetic tests plus typecheck/build. E5-SDK-PUSH-20261029 separately
reproduced one compiled-SDK incoming delivery/callback matching a Node read with
DevTools disconnected and the owned observation tab closed.
See [SDK setup and limits](incoming-sdk.md). The research reproduction does not
establish long-running production reliability for the extracted SDK.
E5-SDK-SOAK-RECOVERY-20261029 additionally observed 900 seconds of idle readiness,
recovered one message sent during a deliberate stop via a separate Node read, and
accepted a fresh subscription with that message in the new baseline. Its final
post-reconnect message check expired without a result. A separately approved new
manual connection then received one NEW test message, one callback matching a
separate Node read (E5-SDK-FRESH-RECONNECT-20261029). All receivers are stopped.
The expired message remains unverified; no automatic recovery, provider duplicate
guarantee or long-running production reliability is established.
The static candidates below remain **HYPOTHESIS** where not established by the
bounded runtime observation. Do not equate a text send's HTTP transport with
incoming transport, or MQTT-looking legacy strings with the active browser path.

## Controlled runtime observation — 2026-10-28

After the owner sent one reviewed B→A test message, the prepared observer found
exactly one new non-A message via Node and matched a fresh browser read in memory.
It was already visible in the UI before the research browser read. No scoped
HTTP read operation was observed before that read. This **REPRODUCES** incoming
retrieval via the existing query, with Chrome open; it does not reproduce push.

The observer saw 21 incoming Lightspeed frames: 19 one-byte frames, one 2281-byte
frame and one 353-byte frame. Only type/size metadata was retained. No payload
was decoded or linked to the specific message, so arrival correlation is
**OBSERVED**, not a verified transport/decoder contract. No agent send occurred.
Observer session 75591 stopped with exit code 0 and discarded private state.

Next: establish actual DGW wire framing/authentication and valid subscription
state, then decode only the agreed conversation's deltas. Do not implement a
subscription from guessed cursors or treat repeated frames as duplicate messages.

Static follow-up recovered the connection constructor and version-5 binary
frame layout before the application envelope. The codec is present as compiled
JavaScript in this artifact despite its WASM wrapper names. See
[DGW wire research](dgw-wire-research.md) for fields, exact source offsets and
remaining runtime checks; none of those static candidates is a verified server
contract yet.

## Standalone push — 2026-10-29

**REPRODUCED** in `/private/tmp/threads-dgw-node-research.mjs`: fresh in-memory
session and exact captured initial subscription frames; accepted stream and
protobuf subscription; owned browser tab closed and DevTools disconnected;
one owner-performed new B→A message decoded in Node and matched to a separate
Node read in memory. No agent DM sent. No new device/sequence state invented.
See E5-NODE-PUSH-20261029 in `experiments.md` and the current handoff for setup,
consumed authorization and limitations. The process is stopped and private state
discarded. Its generic shutdown diagnostic needs intentional-close handling
before the prototype was promoted into SDK code; the extraction now has separate
synthetic stop/close regression coverage. Further live messages need fresh
approval. Reconnect, long-running use, expiry and duplicate behavior unverified.

## Candidate stream and subscription

`WmiSlideAppPlatform` → `WmiIgnitionInstance` → `WmiDGWLightspeedStream` uses
`DGWClient().createStreamGroup({serviceId: "lightspeed", ...})` and establishes a
stream with the initial request encoded as bytes. `/ls_resp` is a logical handler
on this path; the underlying DGW wire framing remains unresolved.

`WmiBarcelonaLsConfig` supplies database `231`, `subscription_type: "slide_gql"`,
snapshot time/version and `graphql_config: {slide_doc_id, variables}`. The public
delta-query definition is `39593085003640601`; variables come from Relay providers
and the query declares `serialized_iris_deltas`.

`WmiLsSubscription` builds `{app_id, device_id, payload, request_id, type: 2}`.
Its serialized payload includes database, epoch/failure counts, last applied
cursor `{seq_id}`, sync parameters and version. Static presence is not proof
that a guessed initial sequence or device state is accepted by the service.

## Decoder and delta application

Received bytes become a JSON envelope with `request_id`, error fields and
`payload`. `WmiLsResponseDecoder` base64-decodes the payload and parses it using
the public `MDCoreSyncProtobuf.pb` schema. It is not plain JSON after one decode.

- `LSResponse`: field 1 control-header bytes; repeated field 2 operations;
  field 3 transaction parameters.
- Operation variants: 1 subscribe, 2 resnapshot, 3 delta, 4 noop, 5 failure.
- A delta contains group ID (field 1) and a delta string (field 2).
- The wrapper discards transaction parameters, control header, operation group
  IDs and resnapshot payload. Their presence does not make them required by this
  application path. Sequence IDs and protobuf cursors are not interchangeable.

`WmiSync` passes delta strings through `slideIrisDeltaParser`, reading JSON
`data.slide_delta_processor`. `WmiSlideIrisDeltaHandler` dispatches by `__typename`;
`SlideUQPPNewMessage` inserts a message and updates thread/unread state. Static
sequence logic rejects lower IDs but permits equal IDs, so deduplication is not
established. The decoder validates wire types, bounds, required fields and oneof
membership; an ad hoc base64/JSON parser would omit those checks.

## Provenance and limits

- Subscription/application modules: public
  `/private/tmp/threads-send-static-r6fGHk/def-06b88eedd229.js`, SHA-256
  `06b88eedd229a27a5a5d629b40fd8a40ac019ffac70973e3ce280824262e26d6`.
  Targeted REA parent
  `ev_a53a6d7378412995bfd6f28b2e4502ed3bae0951fdec1624a93d1f6162eee82c`;
  summary `ev_ac97453eac4c60f06c2c12b97c92cf248efc159fdf2efcb7c126b8aeb72d1c85`.
  Source parse completed; 12 files unselected, graph/alias limits reached and
  `__d` module boundaries not recovered. Module text was checked directly; no
  complete call-graph claim follows.
- Decoder: public `/private/tmp/threads-mutation-static-vgYQyJ/a17.js`, SHA-256
  `e4816be35fe86fa905b5419ebe28ae985fa8027549eae8ee53ffd2bee7b6423f`.
  Direct inert-source offsets: `MDCoreSyncProtobuf.pb` 1420163,
  `decodeProtobuf` 1445988, `WmiLsResponseDecoder` 1452246. These decoder findings
  are direct source checks, not conclusions from the separate REA parent above.

No downloaded code was executed. No credentials, account IDs or message contents
are included here. Authentication, DGW wire framing, valid initial sequence and
device state, scoped delta filtering and reconnect behavior need runtime evidence.
Any live test remains confined to the two controlled accounts/agreed chat and
requires a fresh owner-controlled message action; no agent send is authorized.
