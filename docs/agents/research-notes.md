# Research Notes

Each note opens with its verdict and a "read on only if" line. Take the verdict from here; open a
note only when one of its branches is yours.

- **AUTHENIX** (`authenix-research.md`) — rejected as our Broker: it mints the subject identifier
  per identity, has no Person, no local credential, no SLA, and its funding ends 31 Dec 2026. Open it
  for eduGAIN reach without eduGAIN membership, for consent and data-subject design, or to defend
  ADR-0002 and ADR-0003.
- **Cos4Cloud** (`cos4cloud-research.md`) — closed H2020 project; nothing adoptable, its sign-on was
  AUTHENIX. Open it for OGC Best Practice 21-068 (STAplus) before the resource-discovery service
  gets a vocabulary, or for what EOSC onboarding really costs.
- **Veridas** (`veridas-technical-questions.md`) — frozen; five questions sent 10 Nov 2026, awaiting
  a reply. It predates the current identity model and contradicts it in places, deliberately.
- **OpenRed's live branch** (`openred-live-branch.md`) — **spent as advice.** Its `main` once
  predated a model rewrite; `main` was re-pointed on 12 November 2026 and `federation` is cut from
  it like everywhere else. The rule has no exception left: `docs/agents/external-repos.md`. Open the
  note for the measurements, not for its recommendations.
- **`oxlint --type-check`** (`2026-11-18-oxlint-type-check.md`) — it reproduces `tsc --noEmit`
  exactly, on the pins we have, and needs neither TypeScript 7 nor `tsrs`. Unadopted on value, not
  on risk. Open it before folding the two passes into one, or before putting `tsrs` in the gate —
  `issue #83` watches that.
- **The account REST API** (`2026-11-18-account-rest-api-credential-operations.md`) — it reads
  credentials, Identities and sessions, and changes no password and no address: those are
  `kc_action` browser steps. It cannot replace the Account Console from a server. Open it before
  automating a Person's credential operations or building a profile screen.
- **Two compose files in one Dependabot entry**
  (`2026-11-19-dependabot-one-entry-two-compose-files.md`) — one entry reads every compose file in
  its directory into one dependency keyed by the bare image name, so `postgres` in `compose.yaml`
  and in `compose.apps.yaml` is **one** dependency: one pull request rewrites both, each along its
  own tag track, and `ignore: dependency-name` silences both. No single entry can express the
  per-file split `issue #139` wanted — only `exclude-paths`, which drops a whole file, or giving a
  file a directory of its own. Open it before changing `.github/dependabot.yml`, or when a bump you
  expected never arrived.
- **Repeated prose** (`2026-11-20-repeated-prose.md`) — seven consecutive words in two places is
  where prose written twice starts; shorter than that is the domain's own vocabulary.
  `scripts/check-repeated-prose.sh` prints those pairs, and is a reminder rather than a gate. Open
  it before moving the threshold, or before putting the check in CI, which the measurement argues
  against.
- **Conditional subflows and the brokered `email_verified`**
  (`conditional-subflow-and-brokered-email-verified.md`) — no condition Keycloak ships can see what
  an arriving Identity's source said about its address, which is why `broker/verified-email/` is our
  code. Open it before reaching for `conditional-user-attribute`, or to cost anything else that
  needs the brokered context inside a first broker login flow.
- **Withholding an address nobody affirmed**
  (`2026-11-20-withholding-an-unaffirmed-address.md`) — Keycloak will not create a Person without an
  address, because the realm reads the username off it, so the address is taken off the Person in the
  request that created them and removed from the brokered context as well. Open it before touching
  the create path of the first broker login flow, or before assuming a Person's address was affirmed
  by somebody — `issue #148` is why that assumption is not available yet.
- **PostGIS 18 over an older cluster** (`2026-11-21-postgis-18-needs-a-wiped-volume.md`) — an 18
  image adopts nothing a 16 left behind, whichever way the volume is mounted, so promoting a major
  is paid for in the data. ADR-0017 settled Geonity's version by leaving it to Geonity. Open the
  note before mounting a database volume here, or to cost a major that application does ask for.
- **Adding a Local Credential to a brokered Person**
  (`2026-11-23-adding-a-local-credential-to-a-brokered-person.md`) — recovery mints one: "Forgot
  password?" sets a password where the Person held none, and the Identity link and the Person
  Identifier both survive. The Account Console offers the same from the Person's own session. A
  Person holding no address is reachable by neither. Open it before ADR-0005 says what a Person's
  second Identity is, or to cost closing either path — `issue #124` holds the decision.
- **`trustEmail` and userinfo** (`2026-11-23-trust-email-and-userinfo.md`) — the reported advisory
  was real up to Keycloak 26.7.1 and is fixed from 26.8.0; our condition needs 26.8.0 too. When a
  trusted source's userinfo omits `email_verified`, Keycloak would store the Person verified, and only
  our condition stops it. Open it before moving the Keycloak pin, or before reading a Person's
  `emailVerified` to decide anything.
- **What agent-facing docs practice says**
  (`2026-11-23-what-agent-facing-docs-practice-says.md`) — nine projects adopted a blocking prose
  gate and dropped or disabled it, and none was found that kept one; the stated reasons are the
  machinery, almost never the rules. A volume budget on a standing file is settled practice because a
  loader truncates, and a budget per change exists nowhere. Nobody has written a Diátaxis for agents,
  and no tool in common use finds a passage written twice across two files. Open it before making
  `scripts/check-repeated-prose.sh` a gate, or when `issue #165` decides which surface owns *why* —
  not to support a claim about length, which the one paper on it does not.
- **A withheld confirmation mail**
  (`2026-11-24-keycloak-withholds-a-second-confirmation-mail.md`) — Keycloak mails one Person one
  address confirmation every 30 seconds, by a default of its own, keyed on the user id and never
  logged: it re-renders the form saying so instead, which is what `issue #143` was not reading.
  Raising `PATIENCE_MS`, minting a fresh address per run, and lowering the limit in `testing.json`
  are each measured and each useless. Open it before touching `PATIENCE_MS` in `tests/mailbox.ts`,
  or to cost a testing-only cooldown — which needs `broker/README.md`'s "A layer only adds" changed
  first.
- **Signing out across the Brokered Apps**
  (`2026-11-24-signing-out-across-the-brokered-apps.md`) — `django-allauth` 65.15.0 has neither half
  of logout as a relying party, so every path is hand-written; the ID token is unstorable by any
  setting, because `SocialToken` has no field for one; and the logout token's `sub` is the bare
  Keycloak id, not the Person Identifier, so `sid` is what an application can match. Open it before
  the ADR for story 17 or its build tickets, before costing a Brokered App's sign-out, before
  setting the realm's session lifetimes — the longest-lived credential is an application's, not the
  Broker's — or before landing silent sign-in (`issue #157`) where sign-out leaves the Broker
  session alive.
- **What would turn off adding a Local Credential**
  (`2026-11-24-what-would-turn-off-adding-a-local-credential.md`) — CONDITIONAL on the
  `reset-password` execution is declarable, because neither the importer nor the Admin API checks
  `REQUIREMENT_CHOICES`, and it stops the password but not the mail link, which would then sign a
  passwordless Person in with no page at all. The Account Console's button has no declared lever
  short of disabling `UPDATE_PASSWORD` for everybody, `resetPasswordAllowed: false` withdraws what
  ADR-0005 promises, and no shipped condition can see whether a Person holds a password or arrived
  through a source. Open it before declaring a reset-credentials flow in `broker/realm/`, before
  costing a condition or required action of our own, or to write the case `issue #124` asks for.
- **A CONDITIONAL `reset-password`**
  (`2026-11-25-a-conditional-reset-password-turns-recovery-into-a-mail-link-sign-in.md`) — measured,
  and the note above was right: the import keeps CONDITIONAL while the Admin API still refuses to
  offer it, and recovery for a Person holding no password then serves no page and sends them back to
  the application signed in, writing nothing to the Person at all. Recovery for a Person who holds a
  password is unchanged. So the lever converts the path to a Local Credential into a passwordless
  sign-in by mail link rather than closing it. Open it for the declaration to transcribe, or to write
  the case `issue #124` asks for.
- **Two factories under one provider id**
  (`2026-11-25-two-provider-factories-under-one-id.md`) — Keycloak 26.8.1 picks the higher `order()`,
  and the stock factory's is 0; at equal order it picks the factory outside the `org.keycloak`
  packages, which is ours either way. Documented in the Server Development Guide, measured both
  ways, and fixed into the image at `kc.sh build`. The collision is logged at debug only, so a test
  is the only guard, and exactly one case of `tests/github-source.test.ts` fails on the stock
  provider. Open it before deciding `issue #225`, before registering a factory under an id Keycloak
  already uses, or to write that test.
- **Reading the Broker's pages** (`2026-11-26-reading-the-brokers-pages.md`) — the regexes
  `tests/brokered-app.ts` used to carry misread 64 of 370 real pages' text: undecoded entities, and
  a script body leaked because Keycloak writes `<SCRIPT>` in upper case. happy-dom and parse5 read
  every page cleanly and pass every adversarial snippet; linkedom, node-html-parser and cheerio each
  have a trap. The harness moved to happy-dom (`issue #91`), adding 2 to 3 seconds to the suite,
  with parse5 as the lighter fallback. Open it before reconsidering happy-dom or picking another
  HTML parser.
- **What stops a session**
  (`2026-11-27-what-stops-a-session.md`) — two hooks and a symlink, not the permission rules. Of 599
  stops in a month the note hook answered for 313, and only 84 of those opened a note;
  `AskUserQuestion` for 163; the GitHub hook for 105, across 56 distinct actions; the shape of a Bash
  command for 18. An allowlist entry would have reached that last row and no other: a hook's
  `ask` outranks the rules. `user_permanent` in a transcript is not a stop.
  Open it before widening `permissions.allow` to cut prompts, before loosening or tightening either
  hook, or to repeat the count: the method is in the note, and a transcript is kept 30 days.
