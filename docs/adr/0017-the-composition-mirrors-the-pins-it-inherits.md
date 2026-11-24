# The composition mirrors what an application pins, and chooses the rest

Three kinds of pin. The kind says who may move it.

**Theirs.** An application's requirements file and lockfile, and the tag its own compose file gives
a datastore we declare beside it. Mirrored: it moves when they move it, never ahead. Every mirrored
tag in `compose.apps.yaml` names the file it mirrors.

**Ours, but not free.** The `FROM` of the Dockerfile we wrote on its `federation` branch (ADR-0009).
The application decides that version: Geonity's API takes `python:3.11-slim-bookworm` because 3.11
is the newest with a wheel for every pin in its requirements, LostAtNight's takes `python:3.12-slim`
to match its production host. The reason sits beside each `FROM`; read it first. Raising one is a
pull request in somebody else's repository (`docs/agents/external-repos.md`).

**Ours.** The proxy (ADR-0012), the mail catcher, the Broker's PostgreSQL, `node:26-bookworm-slim`,
and the `postgres:17-bookworm` under the h3 image we built for OpenRed. Nothing upstream constrains
them, so we keep them current.

The kind follows from whose service it is, not from who else pins the image. All three applications
pin `axllent/mailpit`; our mail catcher is still ours, because one catcher takes everybody's mail
and no application runs that.

**One exception: a pin the integration's own correctness needs.** LostAtNight's `django-allauth`
moved to 65.15.0, where the OpenID Connect provider began validating the ID token instead of
trusting an unsigned userinfo response (ADR-0016). Argue a move like that in the commit, in the
application's words, and leave the version they still run in `docs/migration/<app>.md`.

**The exception is only available while the move leaves the application working**, which is not
something to assume: the same move on OpenRed (`issue #30`) stops registration through its own API
from sending its confirmation mail and fails two of that project's own tests. There the pin stayed
and the integration pays for the check itself — with the pinned allauth's own
`verify_and_decode`, the function behind its Google provider. Run the application's suite on the
proposed version before arguing for it; a pin that cannot be moved is a cost in our code, not a
reason to move it anyway.

Two places the rule does not reach. Geonity's two Vite dev servers resolve their trees afresh
instead of installing what it pins, for the reason beside them in `compose.apps.yaml`. And Geonity's
PostGIS stays on 16-3.5 until that application moves; whether it ever does is not our question.

## Considered Options

- **Mirror everything.** Nothing upstream pins the proxy, the mail catcher or the Broker's database,
  so there is nothing to mirror for them. They would rot with nobody deciding it.
- **Bump everything, because this runs on laptops and not on their hosts.** Rejected on measurement.
  `imresamu/postgis` 16-3.5 → 18-3.6 stopped Geonity's database from starting wherever a volume
  existed (`issue #140`; `docs/notes/2026-11-21-postgis-18-needs-a-wiped-volume.md` for why no mount
  rescues it). It also leaves an image standing for a stack nobody runs, which is the opposite of
  what ADR-0009 builds the composition for.
- **Decide per image, when a bump arrives.** What we were doing. `PR #131` and `PR #132` put two
  mirrored pins in `main`, both passing every check.

## Consequences

- A scanner or bot warning on a mirrored pin is a decision, not an oversight, and not fixed here. A
  real weakness in an application's code goes where `docs/agents/security-findings.md` says.
- `issue #139` owns what Dependabot watches. This tells it which pins to stop proposing, not how.
- Where `compose.apps.yaml` and an application's own compose file disagree on a mirrored pin, this
  repository is the one that is wrong (`issue #98`).
- A mirrored database major invalidates every volume already written, so the move carries the wipe
  and re-seed with it: `pnpm apps:reset`.
- A pin of ours becomes theirs the day they pin it. An `.nvmrc` in a front end would take `node`.
- Deploying the composition would break this rule: a deployment owes currency as well as parity.
  ADR-0009 defers whether that ever happens.
