# Existing implementation research

Accessed 2026-10-27 UTC. This is source research, not authenticated protocol
evidence. README claims, static strings, stars, and HTTP 200 responses do not prove
working DM behavior. Sources were read as untrusted text; none of their login,
signing, challenge, or sending code was executed.

| Source | Observed scope | Currency | Assessment |
| --- | --- | --- | --- |
| [molkex/threads-private-api](https://github.com/molkex/threads-private-api) | Python/TS clients for public posts, replies, feed, search, social, user; generic get/post helpers | Not archived; last push 2026-10-19 | No explicit DM implementation identified in inspected tree/client/social code; medium confidence, not exhaustive proof of absence |
| [junhoyeo/threads-api](https://github.com/junhoyeo/threads-api) | Public profiles, timeline, posts, replies, publishing and historical login | Archived; last push 2023-09-08 | Discontinued; no current DM support established; high confidence about archive status |
| [m1guelpf/threads-re](https://github.com/m1guelpf/threads-re) | Early web Relay GraphQL and mobile authentication/public publishing notes | Not archived; last push 2023-07-09 | Historical research only; its statement that web is read-only is not a current product claim |
| [subzeroid/instagrapi](https://github.com/subzeroid/instagrapi) | Instagram private client, including real Instagram Direct code | Not archived; last push 2026-10-27 | Useful architecture reference; zero verification of Threads compatibility |
| [Official Threads docs](https://developers.facebook.com/docs/threads/) | Public publishing, profiles/media, replies, insights | Landing page says updated 2026-07-02 | Reviewed landing/index does not establish DM API support or permissions |

## Exact inspected references

- molkex tree/client: commit `921662aad651638505a4c37d69b7e67160a5650a`;
  `ts/src/client.ts`, `ts/src/modules/social.ts`, README and complete tree listing.
  `reply()` explicitly targets public thread posts; `getThread()` returns a
  `DiscussionTree`. These are not DM retrieval/send methods.
- junhoyeo: commit `88d9e508702115cce902e6f92882d3da984f8158`;
  `threads-api/src/threads-api.ts`, `threads-api/README.md`, `PRESERVED.md`, tree.
  Root README contains a relative path, so the actual package README was opened.
  Its warning says development stopped following communication from Meta and
  warns about platform terms. Do not treat its former login scheme as current.
- m1guelpf: README on main, retrieved this date. It describes old
  `threads.net/api/graphql`, persisted query IDs, and an application header.
  Those historical public-content values were not replayed or promoted to DM APIs.
- instagrapi: `instagrapi/mixins/direct.py` on master, retrieved this date;
  contains `direct_v2/inbox/` and `direct_pending_inbox` among Instagram Direct
  operations. The README and repository metadata were also reviewed. This moving
  reference was not pinned for reuse and is not a reproducible Threads discovery.
- [Official markdown index](https://developers.facebook.com/documentation/threads.md)
  fetched successfully. Its overview/reference links do not prove DM availability.

GitHub API repository metadata supplied archive flags and push timestamps.
Bounded issue searches for DM/messaging/direct in the three Threads research
repositories found no useful DM evidence. Search coverage is limited by terms,
indexing, and repository scope; no claim is made about every implementation online.

## Applicability and unanswered questions

1. **Actual Threads DMs:** none established by the inspected sources. Current
   authenticated browser traffic is required; implementing their public-reply
   methods would fail this mission.
2. **Instagram overlap:** historical Barcelona paths, Meta infrastructure, and
   Relay provide a reason to investigate shared components. A shared DM backend,
   compatible session cookies, Instagram Direct endpoints, and identical IDs are
   all HYPOTHESIS for Threads. Do not reuse Instagram credentials or endpoints.
3. **Applicable techniques:** correlate one controlled UI action to requests,
   narrow static analysis to observed bundles, separate transport/auth, validate
   decoded responses, retain explicit unknown send outcomes, and deduplicate by
   verified provider identity. These techniques do not depend on old endpoint IDs.
4. **Known constraints:** no authorized test session supplied; client exposure
   of messaging, permissions, region/account eligibility, token lifetime, request
   signing, synchronization, and encryption requirements are unknown. There is
   no evidence that anti-bot behavior or encryption blocks this project yet.
5. **Risk:** private API changes can break clients or restrict accounts. The
   archived SDK warning is concrete maintenance/platform-risk evidence. Review
   applicable terms and current account rules before any deployment.

Next: reopen the project, verify native tools, have the owner authenticate a test
account, and perform E1–E3. Do not run broad bundle crawling or install mobile
tooling while the immediate blocker is simply absence of an authorized session.
