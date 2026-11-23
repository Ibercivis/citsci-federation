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
- **`go-offline` and `package`** (`2026-11-19-what-go-offline-leaves-for-package.md`) —
  `dependency:go-offline` does not fill the local repository: `package` fetches 217 artifacts after
  it and fails with `--offline`, so both Maven commands in `broker/Dockerfile` reach Central. Open
  it before deciding whether `mvn package` loses `--quiet` too, or before costing anything that
  assumes a Maven stage resolves once.
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
