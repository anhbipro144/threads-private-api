Private beta Node/TypeScript SDK for the owner's Threads message integration.

The release contains compiled JavaScript, TypeScript declarations, consumer
guides and a runnable offline example. Install the attached `.tgz` in your
backend and verify it with the attached `SHA256SUMS`. No runtime dependencies,
research tooling, browser state, credentials or captures are included.

Validation includes typecheck/build, synthetic unit tests and a separate
consumer install that executes the SDK tests against the actual bundle.
Controlled live reading/sending/receiving, 15-minute idle listening and bounded
manual recovery were recorded separately; CI performs no live provider calls.

This is an unofficial beta, not a production-stability claim. Authentication is
owner-supplied; genuine expiry, automatic recovery, browser-closed push and
general duplicate guarantees remain unverified. No automatic login, challenge
bypass, resnapshot, reconnect or uncertain-send retry. Every live message still
requires exact approval. See README and usage guides before integration.
