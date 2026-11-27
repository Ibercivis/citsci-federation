<!-- Research note, not a decision. Read 26 November 2026, against the W3C Recommendations and the
implementation reports cited inline. Nothing here was run. -->

# Activity Streams, and how the Fediverse aggregates

**Verdict.** Activity Streams 2.0 is a vocabulary; ActivityPub is the transport, and it is push-only
and guarantees nothing an aggregator needs — no acknowledgement, no ordering, no replay, no history.
The Fediverse has no aggregation layer: every catch-up mechanism it has grown is a pull bolted on
years afterwards, and nobody aggregates statistics over ActivityPub at all. For a page that shows one
Person's permissions, achievements and counters across the Brokered Apps, the transport question is
already answered by ADR-0011 — query what changes fast — and AS2 is usable as the vocabulary for the
event half without ActivityPub coming with it.

**Read on only if** you are costing that aggregated page, choosing how a Brokered App hands data to
anything central, or someone has proposed ActivityPub or the Fediverse by name.

## Two documents, one of which is a protocol

- **Activity Streams 2.0** — W3C Recommendation, 2017. A JSON-LD model: `actor`, `type`, `object`,
  `published`, and `Collection`/`OrderedCollection` with `first`/`next`/`prev` paging. No transport.
  W3C's own scope statement for it includes "recording logs of activity", so a non-social event log
  is not a misuse of the vocabulary.
- **ActivityPub** — W3C Recommendation, 23 January 2018. Server-to-server and client-to-server
  protocol carrying AS2 documents.

Taking the vocabulary without the protocol is allowed and is the cheap half.

## What ActivityPub guarantees

Delivery is one mechanism: `POST` the activity to each recipient's `inbox` (§7.1). Recipients come
from `to`/`bto`/`cc`/`bcc`/`audience`; the sender dereferences a Collection recipient to find its
inboxes, and `sharedInbox` (§7.1.3) exists to collapse many followers on one host into one request.

The guarantees, exhaustively:

- Delivery "SHOULD be performed asynchronously, and SHOULD additionally retry delivery to recipients
  if it fails due to network error" (§7.1). No retry count, no backoff, no give-up rule.
- A reader "MUST perform de-duplication of activities returned by the inbox ... by comparing the `id`"
  (§5.2). Duplicates are expected; the spec never says at-least-once.
- No acknowledgement. No success status code is required for an inbox `POST`.
- No ordering guarantee. `OrderedCollection` "MUST be presented consistently in reverse chronological
  order" — that is presentation of a collection, not delivery.
- No catch-up and no history. Nothing in the document says how to fetch what you missed.
- No authentication for server-to-server. Appendix B.1: "at the time of standardization, there are no
  strongly agreed upon mechanisms for authentication." HTTP Signatures and LD Signatures are named
  once, conditionally, in §4.1. The network runs on convention, not on the spec.
- §6 goes further: "there is no guarantee that time the Activity may appear in the outbox. The
  Activity might appear after a delay or disappear at any period."

**The pull side is a shape, not a mechanism.** `outbox` MUST be an `OrderedCollection`, filtered by
the reader's permissions, paged by AS2. There is no cursor and no `since` parameter, and no way for a
remote server to read another actor's `inbox`.

## What that costs the Fediverse

The consequence has a name: the **quiet fediverse**. A server holds only what was pushed to it, so a
thread is split across hosts and no participant sees the whole of it. Two fixes exist, both pull:

- **Reply-tree crawling.** Depth-first walk of each object's `replies` collection. Proposed April
  2024, merged into Mastodon core March 2025 — Mastodon is the only complete implementation. Cost
  grows linearly with the tree; one unreachable node takes every branch under it; and Mastodon caps
  its own `replies` at 5 per server, so the crawl is incomplete by design.
- **A context owner** (FEP-7888, FEP-171b, FEP-f228, draft). One actor owns the conversation as an
  `OrderedCollection` and publishes an `Add` per accepted member, so backfill is one fetch from one
  authoritative place. Implemented by NodeBB, Discourse, WordPress, Mitra and Streams. It fails
  whole-hog if that owner is down, and it only sees what reached the root.

**Fanout has a hub, and it is still push.** A server subscribes to a relay by sending a signed
`Follow` to the relay's inbox; the relay re-broadcasts `Create`, `Update`, `Delete` and `Move` to
every subscriber, signed as itself. Relays are how a small instance gets volume — not how anything
gets queried.

**Push in production is a queue and a dead-letter list.** Mastodon's delivery worker retries 16
times, roughly two days, with a failure threshold and cooldown per unreachable host; exhausted jobs
go dead and an admin retries them by hand. That is the floor for any push system we would build.

**Statistics are not pushed at all.** Instance directories poll `/.well-known/nodeinfo` (and, for old
software, `statistics.json`) with crawlers. Their numbers disagree with each other and are known to
undercount, because a crawler sees only what answers it.

## Where this misses what we want

The page in question shows **state** — current permissions, achievements held, totals. ActivityPub
carries an **event log** whose transport admits loss, duplication and reordering, and defines no
replay. Deriving current state from that is event-sourcing over a channel that promises nothing, and
the aggregator would be the component that pays for it.

Permissions are the sharp case. ADR-0003 keeps roles local to each Brokered App and ADR-0011 names
the app as the authority for anything scoped to an object inside it. A page may **display** a scoped
grant; a central store that mirrors it becomes a second authority that is wrong between pushes. Three
kinds of state, three different answers, and only the slow one tolerates being carried:

| | Freshness it needs | What ADR-0011 implies |
|---|---|---|
| Permissions and scoped grants | exact, now | query the app |
| Achievements | stable once earned | carried safely |
| Counters and statistics | approximate | either, cheapest wins |

## The standards that do model this

- **Achievements**: AS2 has no badge type — the W3C wiki's expanded vocabulary lists achievements as
  a use case and is a draft, not a spec. **Open Badges 3.0** (1EdTech, released May 2024, built on
  W3C Verifiable Credentials 2.0; certification guide v1.3, December 2025) models an achievement,
  signs it, and makes it portable out of our federation. Consumer-side implementation was reported
  thin in July 2024 — worth re-checking before relying on anyone else reading ours.
- **Participation statistics**: **xAPI** with a Learning Record Store is the existing "every app
  sends statements to one store" design, explicitly distributed, with ADL's Total Learning
  Architecture MOM as the cross-application rollup profile. Multi-source aggregation in one LRS is a
  recognised weak spot, not a solved default.
- **Users and permissions**: provisioning standards, not activity vocabularies.

## What would change our mind about ActivityPub

Two conditions, either of which makes it worth revisiting. A Brokered App already speaks it, so the
integration cost is somebody else's sunk work. Or the goal stops being a profile page and becomes a
public, outward-facing stream that other projects consume — at which point federating is the point,
and the lossiness is acceptable because no page's correctness depends on it.
