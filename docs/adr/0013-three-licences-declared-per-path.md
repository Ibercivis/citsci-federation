# The code is EUPL-1.2, the documentation CC BY 4.0, and the Keycloak plugin Apache-2.0

The repository carries **three licences, and each file has exactly one.** The code is under the
**EUPL-1.2**. The documentation — the ADRs, the spec, the glossary, the notes and every Markdown
file — is under **CC BY 4.0**. The OpenID Federation plugin for Keycloak, which does not exist
yet, will be under **Apache-2.0**. Which file is under which licence is declared in `REUSE.toml`,
in the format of the FSFE's REUSE specification, and `pnpm check` fails when a file's licence
cannot be established or its text is missing. No grant or funding agreement sets the licence
today; this is our choice.

**The code takes the EUPL because the foundation's work usually does.** It is the licence the
organisation has chosen most often, and most recently, for the work it writes itself. It is
copyleft, so an improvement to what is published here stays published, and it was written for
European public-sector work, which is the kind this is.

**The documentation takes CC BY 4.0 because it is meant to be adopted.** The identity model in the
glossary and the ADRs is most useful if another organisation can lift it into its own proposal,
and CC BY asks for nothing more than credit. Creative Commons does not recommend its licences for
software, so a code example meant to be run belongs in the code tree; a snippet that only
illustrates a point can stay in the prose.

**The plugin takes Apache-2.0 because it is going to leave.** It is built to be extracted into a
project of its own, in an ecosystem — Keycloak and the forks of it that implement OpenID
Federation — that is Apache-2.0 throughout, where a copyleft plugin would be one nobody upstream
can take in. Being extracted with `git filter-repo` keeps the plugin's history, so that history
has to be Apache-2.0 from its first commit. The plugin's directory therefore carries a `LICENSE`
and a `REUSE.toml` of its own from that commit, rather than an entry in the root file that the
extraction would leave behind.

## Considered Options

- **Apache-2.0 for all the code.** One licence for the whole code tree, and the one the plugin
  needs anyway. Rejected because it gives up copyleft where nothing requires us to, and the
  foundation's own work leans the other way.
- **EUPL-1.2 for everything, the plugin included.** Rejected: it would make the plugin's history
  copyleft before it reached an ecosystem that is not.
- **CC BY-SA 4.0 for the documentation**, the copyleft equivalent. Rejected: it would bind
  whoever adapts the model to share their adaptation under the same terms, which is a reason not
  to adopt it.
- **A `LICENSE` file per part and a sentence in the README, without REUSE.** Rejected because it
  leaves the edges to interpretation — a configuration file, a script in `docs/` — and nothing
  fails when a new file falls between them.

## Consequences

**Code crosses from the plugin into the rest, never the other way.** Apache-2.0 code may be
included in EUPL-1.2 work; EUPL-1.2 code copied into the plugin would bind it. A helper both need
is written in the plugin.

**The root `LICENSE` is the EUPL-1.2 text** because that is what GitHub's licence detection reads.
The full texts `REUSE.toml` refers to live in `LICENSES/`; `reuse lint` fails when one is missing
or when one is present and unused. Apache-2.0 is therefore added to `LICENSES/` with the plugin,
and not before.

**`pnpm check` needs Docker.** `reuse` is a Python tool, and `pnpm reuse:lint` runs it from its
official image, pinned by digest, rather than adding a Python toolchain beside Node. The Broker
needed Docker already, but the formatter, the linter and the type checker did not, and now
`pnpm check` and the `pre-push` hook fail when Docker is not running.
