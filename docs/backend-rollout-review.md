# Threads-only backend rollout candidate

**Archived candidate:** the owner later prioritized sending, accepted the local
read/send prototype, then requested removal of the website prototype. Its runtime
is stopped and its integration is removed. Do not follow the old rollout plan or
revive this checkout without a new explicit task. Current results:
`docs/milestones/2026-10-28-local-threads-dm.md` and `docs/agent-handoff.md`.

Prepared 2026-10-28. Inbox screen deferred at the owner's request.

## Candidate

- Checkout: `/private/tmp/tiemdosime-threads-candidate-f7ttDm`
- Branch: `change/threads-read-only-f7ttdm`
- Base: current production `origin/main`, revision
  `4f123275d2fdb600e6b90eb7236bdd624746124d` (successful release 42).
- Owner approved item 2 (commit only); the exact 17 reviewed files are committed
  as `e0eedf60d5d4813f75225db84687add07547c0d2` on the candidate branch.
  No push or production deployment occurred. The candidate worktree is clean.
- The original `develope` checkout and unrelated backup changes are preserved.

## Included change

The already-tested read-only Fastify routes and private Next.js proxy consume the
exact `threads-private-api-0.1.1.tgz` package. They return one page on an owner's
request, filter to the agreed conversation, reject sending and avoid private
response caching/logging. The existing owner-only Tailscale boundary is reused;
there is no extra password, new screen, database migration or public port.

Production Compose optionally loads `/srv/tiemdosime/private/threads-read.env`
for the API alone, using raw env-file mode. The worker and frontend do not receive
the session. The intended file is root-owned, mode 0600, outside all repository,
image and release artifacts. Missing/invalid configuration leaves reads disabled.

CI adds the synthetic Threads configuration/routes/proxy checks, an API-only
Compose environment check, packaged-image disabled-route checks and public-ingress
denial checks. The normal check → publish → deploy workflow remains intact.

## Verification status

- Prior controlled local live test: one allowed conversation and six messages
  matched browser baselines; an unrelated scope request was denied; no sends.
- Candidate workspace typecheck and production build passed.
- Candidate synthetic configuration, Fastify route, Next proxy and Compose checks
  passed. The Compose test checks raw JSON, quotes/dollar signs, API-only access
  and safe absence of the optional private file.
- Preflight found the host healthy: supervisor active, six healthy containers,
  current and successful revisions agree at release 42; no newer main run was
  in progress.
- The full deployment suite needs Linux (`/usr/bin/flock`, real `/tmp` semantics).
  It could not finish correctly on macOS. The same compiled deployment suite
  passed in a disposable, network-disabled local Colima Linux container:
  **35 tests passed, zero failed**. Linux CI remains mandatory before
  publication/deployment. No production image was manually built or deployed.

## Required owner decisions

Automatic approval review blocked transferring authenticated Threads session
cookies/headers from Chrome to the homelab because explicit destination-specific
authorization was missing. Nothing has been transferred or provisioned there.
The owner instead asked to complete local testing before moving to the homelab.
That question is not transfer authorization. No credential value should be pasted
into chat.

The commit permission was consumed exactly for this candidate. Do not request
that permission again. Transfer and rollout remain deferred for local-first
review; unrelated owner edits stay excluded.

## Running local HTTP verification

The follow-up check passed using the existing remote-debugging Chrome → actual
local Next website → actual local Fastify HTTP API → Threads. One conversation
and six messages matched fresh browser baselines. Private no-store headers were
present, out-of-scope reads returned 404, and local POST attempts returned 405
without a provider write.

Temporary website: `http://127.0.0.1:60616`; inbox path `/inbox/threads/api`.
Both servers use unused loopback ports. The session stays in the local API's
memory; no credential is in the Next child's environment, on disk, or on the
homelab. No new screen was built. Tool session `24819` owns the broker and local
servers; `stop-local-http` closes those servers and their owned local tab.
The owner's Threads tab and Chrome remain open.

## Rollout after authorization

1. Verify reads from the homelab using the same consented chat, with session data
   streamed through encrypted SSH and held only in memory during the probe.
2. Install the API-only root-readable private settings after successful reads.
3. Use the existing candidate commit; integrate fresh main in the isolated
   release checkout and push through the existing checked workflow. No force push
   or direct image deployment over SSH.
4. Wait for check, publish and deploy to succeed. Normal rollout can briefly
   interrupt service for its paired backup and restart.
5. Verify release SHA/sequence, supervisor/container health, existing website
   endpoints, private Threads reads and public ingress denial. Do not print any
   private bodies/IDs/session values or send a DM.
