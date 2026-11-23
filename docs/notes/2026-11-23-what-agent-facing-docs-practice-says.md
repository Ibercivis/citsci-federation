<!-- Research note, not a decision. External practice, researched 23 November 2026 from primary sources. -->

# Nobody has a Diátaxis for agents, and nine projects dropped the prose gate

**Verdict.** External practice is **thinner than the ticket hoped on three of its four questions and much
richer on the fourth**. On audiences there is no framework: Diátaxis divides by *need* and the word
"audience" appears nowhere on its site, it has never mentioned an agent reader, and the question was put
to its author three times and answered none of them. On *one place per question* the sources **disagree
with each other**, and three of them — Google, a Rust RFC, Astro's own reviewers' guide — argue
affirmatively *for* bounded duplication on the reader's behalf. On measurement, four vendors assert that
a longer instruction file is followed less, two enforce caps on it, **none has published the eval**, and
the one paper that tested context-file length against outcome found no correlation. The question that
paid out is **instruments**: nine named projects adopted a documentation prose gate and dropped or
disabled it, and no project was found that ran a blocking one and kept it without retreat. The stated
reasons are almost never that the rules were wrong — the gate's machinery failed before its judgement
did. One asymmetry runs through everything: **a volume budget on a standing file is a settled instrument
because a loader truncates; a volume budget per change does not exist anywhere, because nothing truncates
a pull request body.** And no tool surveyed detects a passage written twice in two files.

**Read on only if** you are choosing between the four instruments, deciding which surface owns *why* and
*what breaks*, or about to cite external practice for a claim about length.

## 1. Audiences, and who separates them

**Diátaxis divides by need and refuses to divide by reader.** Its four kinds answer "action or cognition?
acquisition or application?" ([compass](https://diataxis.fr/compass/)), and the needs are held to be
those of one figure, "the practitioner in a domain of skill"
([foundations](https://diataxis.fr/foundations/)). The string "audience" appears **zero times** across
every page of diataxis.fr, as do "persona" and "user groups".

The remedy it prescribes to a surface that wants to say a second thing is **a link**, never a section.
A page that absorbs another kind "removes them from view in the correct place"
([explanation](https://diataxis.fr/explanation/)); reference must instead "link to how-to guides,
explanation and introductory tutorials" ([reference](https://diataxis.fr/reference/)).

Where our ADRs land under its own compass is *explanation* — it lists "design decisions, historical
reasons, technical constraints" and "choices, alternatives, possibilities" as explanation's subject
matter (inferred; Diátaxis never mentions ADRs).

**Diátaxis says nothing about agent readers, and not for want of being asked.** Zero hits for
AI/LLM/agent/generative across every page and the site's own search index. Three items in its tracker
raise it and its sole author commented on none —
[issue #141](https://github.com/evildmp/diataxis-documentation-framework/issues/141),
[issue #170](https://github.com/evildmp/diataxis-documentation-framework/issues/170), and
[PR #162](https://github.com/evildmp/diataxis-documentation-framework/pull/162), closed unmerged as
stale. The audience question itself
([discussion #93](https://github.com/evildmp/diataxis-documentation-framework/discussions/93)) got
practitioner answers only.

**The only axis agent-facing practice has is audience, and it is the whole of its argument.**
[agents.md](https://agents.md/): "README.md files are for humans... AGENTS.md complements this by
containing the extra, sometimes detailed context coding agents need... We intentionally kept it separate
to: Give agents a clear, predictable place for instructions. Keep READMEs concise and focused on human
contributors." It then declines any taxonomy within that surface — "No. AGENTS.md is just standard
Markdown. Use any headings you like" — and invites everything in: "anything you'd tell a new teammate
belongs here too". That sentence is the anti-Diátaxis position: one undifferentiated surface, divided by
who reads rather than by what is needed. The argument is contested in its own tracker
([issue #130](https://github.com/agentsmd/agents.md/issues/130), 2026-01-02, "I strongly believe
`AGENTS.md` discourages writing and maintaining good `README.md`s") and **no maintainer replied**.

**The reviewer/editor split is real, published, and has a vendor convention behind it.** This is the
ticket's (a) versus (b), and it is the one audience distinction anyone has actually built.

| Artifact | What it separates | Primary source |
|---|---|---|
| `REVIEW.md` | the reviewing agent from the editing agent | [docs.devin.ai](https://docs.devin.ai/work-with-devin/devin-review) publishes it as a convention: "a dedicated instruction file for Devin Review" |
| `cloudflare/workers-sdk` | same, deliberately | [PR #13849](https://github.com/cloudflare/workers-sdk/pull/13849) (merged 2026-05-07): "**Content is split by audience**" — `REVIEW.md` for reviewers, `AGENTS.md` for the rest |
| `expo/expo` | ten role-scoped reviewers, each owning one kind of finding | [`.expo-agents/code-review/shared.md`](https://github.com/expo/expo/blob/main/.expo-agents/code-review/shared.md): "**You cannot read `CLAUDE.md`, `AGENTS.md`, or `.claude/`.** The tree you read is scrubbed of them at every level... Everything you need from them is inlined below." |

Expo's is the hardest boundary found: the reviewing agent is *denied* the editing agent's context, and the
overlap is resolved by inlining rather than by sharing. Its `general.md` then assigns ownership between
reviewers by kind of defect — "The specialists own the rest... If a finding is a bug that one of them can
see, leave it to them."

**The policy-decider in two years has no surface of their own anywhere, and two primary sources refuse
to give them one.** Nygard's original ADR post is written "as if it is a conversation with a future
developer", and raises the audience-separation objection only to resolve it by keeping one surface and
making it reachable
([2011-11-15](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)). Google asks
a change description to "include enough context **for reviewers and future readers**"
([cl-descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html)) — one
surface, two named audiences, no split — while splitting the reviewer from the author into two separate
guides ([eng-practices](https://google.github.io/eng-practices/)).

**Nobody has written a documentation-kinds framework for agents.** What exists is a kinds taxonomy on a
different axis — **loading cost**, not reader need. The
[Agent Skills specification](https://agentskills.io/specification) divides metadata (~100 tokens, always
loaded) / instructions (<5000 tokens, on activation) / resources (on demand), with **zero occurrences of
"human", "audience" or "reader"**. The one genuine routing rule found anywhere is cost-shaped too, and is
the closest external analogue to the ticket's question 2: write a skill "when a section of CLAUDE.md has
grown into a procedure rather than a fact"
([code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)). The one community attempt at
a kinds taxonomy, [agents.md issue #71](https://github.com/agentsmd/agents.md/issues/71), is open,
unadopted and argued down in its own thread.

## 2. One place per question

**Four large projects have the rule, and all four phrase it as which page type owns the depth — never as
"don't say it twice".**

- `denoland/docs` AGENTS.md, the most explicit and the only one naming review as its enforcement: "**A
  topic's depth lives in exactly one place.** ... **Don't repeat flag documentation in a guide: link to
  the reference instead.** A guide may include at most one summary table when it links to the full
  reference."
- `django/django`
  [writing-documentation.txt](https://github.com/django/django/blob/main/docs/internals/contributing/writing-documentation.txt):
  "**Link to reference material rather than repeat it.**"
- `kubernetes/website` content-guide: "Dual-sourced content requires double the effort (or more!) to
  maintain and grows stale more quickly."
- `python/cpython`: cross-referenced "**rather than repeated for every affected interface**".

**Three primary sources argue the other way, for the reader.** This is the finding that most complicates
the ticket's question 2.

| Source | What it says |
|---|---|
| Google, [cross-references](https://developers.google.com/style/cross-references) | "**When possible, provide help in context rather than linking elsewhere.**" With the cost model: "**Each link creates a decision for the reader, adding cognitive load.** Each link is also a chance for the reader to leave the page and lose their place." |
| Rust RFC 1574 | written specifically to undo the "refer to the module-level documentation" pattern in std: "each type should document itself fully. **It is okay if there is some small amount of duplication here.**" |
| `withastro` reviewers' guide | "typical editing advice to '**cut mercilessly**' **refers to words and phrases, not ideas and context**." Its "too little" checklist names "**too little 'why'**" and "**too few basics just because they are 'documented elsewhere'**" as defects. |

Django adds the argument against compression itself: "**Some friction is necessary for a reader to grasp
a concept.**" It then prints a human passage beside an AI-smoothed "frictionless version" of it, and
criticises the shorter one for what it loses.

**On why versus how, five of six separate them and four do it via Diátaxis or a Diátaxis-shaped
taxonomy.** Sharpest is Django: "**Reference guides aren't the place for general explanation.** If you
find yourself explaining basic concepts, you may want to move that material to a topic guide." cpython
names Diátaxis outright — reference "should describe rather than to explain", explanation "**answer
'why' questions**". Deno: "Guides teach, reference enumerates."

**Rust is the outlier, and the most interesting for an agent-facing repository.** It imposes no why/how
split and instead requires each claim to carry its **provenance and decay** — "consider including: — A
reason for why the text may be out of date other than 'change'... — The date the comment was added" —
with a `<!-- date-check --> Jul 2026` annotation and CI reporting entries over six months old. For code
comments, Google states the ownership rule plainly: comments "explain **why** some code exists, and
should not be explaining **what** some code is doing... mostly comments are for information that the code
itself can't possibly contain, like the reasoning behind a decision"
([looking-for.html](https://google.github.io/eng-practices/review/reviewer/looking-for.html)).

**The conventions themselves mostly bound nothing.** Checked for what each says about length, duplication
and scope:

| Convention | Bounds length? | Addresses duplication? |
|---|---|---|
| [agents.md](https://agents.md/) | **No** — nothing on length, size, tokens or context cost anywhere in its published prose | **No** — never says don't repeat the README |
| [Claude Code](https://code.claude.com/docs/en/memory) | **Yes** — "target under 200 lines per CLAUDE.md file"; warnings; hard truncation | **Yes**, as contradiction risk; ships `/doctor prompt-audit` to find it |
| [Cursor](https://cursor.com/docs/rules) | **Yes** — "Keep rules under 500 lines" (advice; nothing says what happens at 501) | **Yes** — "**Duplicating what's already in your codebase**: Point to canonical examples instead of copying code" |
| [OpenAI Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | **Yes, in bytes, enforced** — `project_doc_max_bytes`, 32 KiB default, silent truncation | **No** |
| [GitHub Copilot](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions) | **Partly** — "short, self-contained statements"; "no longer than 2 pages" only inside its generator prompt | **Partly** — "avoid providing conflicting sets of instructions" |
| [Devin](https://docs.devin.ai/cli/extensibility/rules) | **Qualitatively** — "**Rules and AGENTS should be kept as small as possible**"; prefer Skills | **No** |
| Gemini CLI, Aider, Continue, Amp, Zed, OpenCode | **No** — zero prose on size, tokens or limits in any of the six | **No** |

Two conflicts here mean no appeal to consensus is available. **Pointer versus inline**: Cursor says
"Reference files instead of copying their contents... prevents them from becoming stale", then qualifies
itself — "**Put anything that must always be in context directly in the rule body**" — while Copilot
lists "Requests to refer to external resources" among things that "may cause problems" in a large
repository. **Copy the README or delete it**: GitHub's published generator prompt fills spare space with
"the contents of the README, the contents of any key source files", where Claude Code's test is "Could it
find this by reading the code? Would it actually go and look? If both are yes, leave it out."

**The agents.md tracker holds at least six attempts to add length guidance, 2026-01 to 2026-11. One was
closed unadopted; the rest sit open.** [#135](https://github.com/agentsmd/agents.md/issues/135) proposed
"aim for under 500 lines" and was closed 2026-08-24 without adoption;
[PR #190](https://github.com/agentsmd/agents.md/pull/190) "docs: add context budget guidance" is still
open; also #207/#208, #242, #249, #260, #261. The published convention still bounds nothing.

## 3. Instruments, and whether they hold

**Nine named projects adopted a documentation prose gate and dropped or disabled it. None was found that
ran a blocking prose gate and kept it without retreat.** This is the strongest evidence in the note and
runs against the checker-as-gate.

| Project | Gate | Fate | Primary source |
|---|---|---|---|
| **bokeh/bokeh** | Vale in CI | adopted 2021-01-06, **removed 2021-01-07** — lifetime ~19 hours | [PR #10823](https://github.com/bokeh/bokeh/pull/10823): "Vale currently seems to not work with pull requests that are based on a forked repo" |
| **influxdata/docs-v2** | Vale | **deleted 2026-11-14** | [PR #7916](https://github.com/influxdata/docs-v2/pull/7916): "**Vale cost more to configure and work around than it found**"; "**No style check blocks a merge**" |
| **pyOpenSci** | Vale | adopted 2024-06, **removed 2026-10** after a 28-month argument | [#811](https://github.com/pyOpenSci/python-package-guide/pull/811); [issue #317](https://github.com/pyOpenSci/python-package-guide/issues/317): "it spit out like a thousand warnings and errors"; "**I think it was a good idea on paper but it's not really worth it**" |
| **n8n-io/n8n-docs** | `fail_on_error: true` | **downgraded after two days**, and has held for nearly three years | commit `c1b3c428`, 2024-01-25, subject "**restore warnings, don't fail on error**" |
| **ray-project/ray** | Vale, two gates | **disabled 2026-09-22**, still off two months on | [PR #66354](https://github.com/ray-project/ray/pull/66354); replacement doctrine is four PRs titled "**warn-first, not yet enforced**" |
| **DataDog/documentation** | Vale | added 2020-12-30, **removed 2021-01-14**, re-added the next day | [PR #9495](https://github.com/DataDog/documentation/pull/9495): "Remove Vale Linter (for now) ### Motivation **Workflow errors**" |
| **NHS England** | Vale | **removed by ADR across four repos**, Nov 2026 | [nhs-notify-shared-modules#355](https://github.com/NHSDigital/nhs-notify-shared-modules/pull/355): "**remove Vale because it adds noise without tangible benefit**" |
| **keycloak/keycloak** | Vale config | **deleted 2026-08-18** | [#51698](https://github.com/keycloak/keycloak/pull/51698): "Removing the .vale.ini file as we don't use Vale" — it closes the ticket *to fix* the gate |
| **canonical/starbase** | Vale | **disabled 2026-02-13** in the template many Canonical repos are cut from | [#489](https://github.com/canonical/starbase/pull/489): "compatibility issues with our actual docs, and **there's currently no official way to override them**" |

**The stated reasons are almost never that the rules were wrong.** They are: it broke on forked pull
requests (Bokeh), workflow errors (DataDog), it cannot run in our environment (InfluxData), the binary
download costs more than the rule earns (pyOpenSci), noise without benefit (NHS), no override mechanism
(Canonical), one rule reddens unrelated pull requests (Fly.io,
[superfly/docs#2432](https://github.com/superfly/docs/pull/2432): "**450 findings in 216 files, nearly
all false positives**"). The machinery fails before the judgement does.

**The surviving design is advisory with a written promotion bar, and three projects converged on it
independently.** `vale-action`'s own `action.yml` ships `fail_on_error` defaulting to `"false"` and
`filter_mode: "added"` — the official action does not fail the build out of the box. `coder/coder` states
the bar: a rule promotes to error "only when (a) its false-positive rate against real content is
effectively zero and (b) the existing-content violation count for that rule is also zero"
([PR #25467](https://github.com/coder/coder/pull/25467)), then escalates **one rule per pull request**,
eleven merged over two months. LSST's `documenteer` reaches the same shape and says why plainly: "No
further corpus cleanup was attempted; **that is what the advisory tool is for**."

**What the two tiers do, measured by the heaviest Vale user alive.** GitLab's
[issue #607939](https://gitlab.com/gitlab-org/gitlab/-/issues/607939), open since 2026-08-04, is titled
"Docs: Audit Vale rules for usefulness" and opens "**We should consider removing the ones that are not
proving useful to us anymore.**" Its measurement on `master`, 3,150 files: **0 errors, 9,551 warnings,
16,781 suggestions**. Its own explanation: "**Error rules block CI, so their live count is 0 by
definition** — any violation is fixed before merge." An earlier run over 2,832 files gave 9,873 warnings
and 12,736 suggestions. The blocking tier is empty because it blocks; the advisory tier holds 26,326
findings and grows with the corpus.

**No tool in common use detects a passage written twice.** Checked at source, not from documentation:

| Tool | What it actually bounds |
|---|---|
| Vale `Repetition` | **adjacent token, within one sentence.** [`repetition.go`](https://github.com/vale-cli/vale/blob/v3/internal/check/repetition.go) deliberately suppresses cross-sentence matches: "If we have more than one sentence, we're likely looking at a false positive". It catches `the the`. |
| proselint `lexical_illusions` | **an immediately-following repeat of a 1-to-4-word phrase** — a regex backreference. The closest any tool gets. curl disables it in both of its configs. |
| markdownlint | **duplicate headings in one document**, and MD024 says it is an anchor-collision rule. |
| textlint | **architecturally cannot** — rules are per-file AST visitors and `RuleContext` exposes only `getFilePath()`. No API lets a rule see another file. Four plausible rule package names all 404 on npm. |

**A document word-count gate exists in Vale and its heaviest user declines to use it as one.**
`extends: metric` takes a formula over document statistics, so `formula: words`, `condition: "> 400"` is a
prose budget available today ([docs.vale.sh/checks/metric](https://docs.vale.sh/checks/metric)). Of
GitLab's 51 `gitlab_base` rules, two measure anything — `SentenceLength` and `ReadingLevel` — **both at
sentence scope, both at `level: suggestion`**, and together the two largest sources of its advisory
backlog.

**A volume budget on a standing file is settled. A volume budget per change does not exist.** This
asymmetry is the most transferable finding in the note.

Standing files, verified by hand:

| Project | Budget | Enforcement |
|---|---|---|
| `webpack/webpack` | **40,000 characters** on `AGENTS.md` | [`tooling/check-agents-md-size.js`](https://github.com/webpack/webpack/blob/main/tooling/check-agents-md-size.js), `process.exitCode = 1`, wired as `lint:agents` and running **first** in `yarn lint` |
| `DataDog/dd-trace-js` | **200 lines** | `scripts/check-agents-md-size.js`, `MAX_LINES = 200`, in `lint.sh`, with its own spec file |
| `esp-rs/esp-hal` | 80 lines | prose only: "To add something, first remove or shorten something else." |

webpack is the one to read, because it pairs the budget with the two rules that keep a budget from
becoming deletion, and separates volume from duplication — the checker bounds only the first:

> **Size budget: 40,000 characters**, where Claude Code starts warning about a large instruction file...
> Over budget, move a task-specific section to `docs/<topic>.md`, leaving its heading, its `[!REQUIRED]`
> callout, one line per rule it enforces and a link.
> **Never drop a rule, fact, number or reason to shorten**: move it verbatim, reword or merge.
> **One fact, one place**: link instead of restating.

**Every one of these budgets exists because a loader truncates**, and the comments say so without
exception — "Codex reads only the first 32 KiB... and silently drops the rest". The number is a fact
about a tool, not a style judgement.

Per-change prose, by contrast:

- **commitlint's total-volume rule ships disabled.** `body-max-length` defaults to **`Infinity`**, and is
  absent from `@commitlint/config-conventional`, which ships three *line-width* caps at 100 as hard
  errors. Most configs that mention it do so to switch it off.
- **Linux `checkpatch.pl` bounds commit-log line width and a minimum**, never a maximum:
  `COMMIT_LOG_LONG_LINE` warns once at 75 columns, and `$commit_log_lines < 2` warns on a missing
  description. A 400-line commit message wrapped at 70 columns passes clean.
- **Not one of the ten largest projects' pull request templates bounds its body** — checked at
  kubernetes, rust, node, react, vscode, go, electron, deno, next.js, angular. Every one demands *more*,
  and several enforce a minimum socially (React: "If you leave this empty, your PR will very likely be
  closed."). The most prescriptive budget found anywhere is trpc/trpc's template asking for "under 200
  words", which none of its ten workflows checks.
- **CI checks on body length are overwhelmingly minimum-direction.** `Provenance-Emu` states the
  asymmetry in two adjacent lines of its `Dangerfile.swift`: `if github.pr_body.length > 1000 { warn(...) }`
  / `if github.pr_body.length < 5 { fail(...) }`. **Too long warns. Too short fails.**

**The kernel's answer to a long description is to split the change, not to cut the prose.** From
`Documentation/process/submitting-patches.rst`: "**Solve only one problem per patch. If your description
starts to get long, that's a sign that you probably need to split up your patch.**" This is the only
primary source found that treats prose volume as a diagnostic signal about the change rather than as a
defect in the writing.

## 4. Measurement

**Real instruction files, measured today** (`gh api` + `wc`). Median 854 words; the range is two orders
of magnitude.

| Repository | File | Lines | Words |
|---|---|---|---|
| `webpack/webpack` | AGENTS.md | 338 | 5,260 |
| `vercel/next.js` | AGENTS.md | 530 | 4,318 |
| `apache/airflow` | AGENTS.md | 253 | 3,166 |
| `sst/opencode` | AGENTS.md | 220 | 2,620 |
| `rust-lang/rust` | AGENTS.md | 264 | 1,930 |
| `zed-industries/zed` | AGENTS.md | 189 | 1,888 |
| `denoland/deno` | CLAUDE.md | 432 | 1,703 |
| `expo/expo` | AGENTS.md | 119 | 1,586 |
| `DataDog/dd-trace-js` | AGENTS.md | 186 | 1,562 |
| `withastro/astro` | AGENTS.md | 164 | 1,321 |
| `cloudflare/workers-sdk` | AGENTS.md | 157 | 1,148 |
| `denoland/docs` | AGENTS.md | 91 | 560 |
| `astral-sh/uv` | AGENTS.md | 48 | 551 |
| `esp-rs/esp-hal` | AGENTS.md | 49 | 412 |
| `anthropics/claude-code` | CLAUDE.md | 39 | 331 |
| `temporalio/temporal` | AGENTS.md | 41 | 315 |
| `agentsmd/agents.md` | AGENTS.md | 42 | 292 |
| `kubernetes/kubernetes` | AGENTS.md | 38 | 259 |
| `ghostty-org/ghostty` | AGENTS.md | 39 | 225 |
| `modelcontextprotocol/typescript-sdk` | CLAUDE.md | 13 | 218 |
| `python/cpython` | AGENTS.md | 28 | 147 |
| `microsoft/vscode` | AGENTS.md | 6 | 50 |

Two readings worth keeping. **Six of these are pointers rather than copies**: vscode's 50 words are a
link to `.github/copilot-instructions.md`; `cloudflare/workers-sdk`'s `CLAUDE.md` is 132 bytes ending
"See @AGENTS.md"; `apache/airflow`'s `CLAUDE.md` is a **symlink**, mode `120000`, nine bytes — pointer
not copy, enforced by the filesystem. And **webpack sits at 36,254 of its own 40,000-character budget**:
a budget set where the loader warns, 91% consumed, with the project still writing.

The strongest published pointer rationale is cloudflare's, in its `AGENTS.md` itself: "Prefer
authoritative configuration and documentation over copying details into this file: **copied versions,
rule lists, and counts become stale.**" expo's is the strongest instruction: "Read CONTRIBUTING.md. It is
the source for setup, package scripts, tests, documentation, and changesets. **Do not copy those steps
into a new guide.**"

**Instruction-file length versus adherence: asserted by four vendors, enforced by two, measured by
none.**

| Source | Statement |
|---|---|
| [Claude Code memory](https://code.claude.com/docs/en/memory) | "**Size**: target under 200 lines per CLAUDE.md file. **Longer files consume more context and reduce adherence.**" Hedged elsewhere on the same page to "may reduce adherence". Imports "don't reduce its context cost". |
| [Claude Code best practices](https://code.claude.com/docs/en/best-practices) | "every line in it takes a little of Claude's attention on *every* task, whether it's relevant or not"; "**If the line is getting lost in a long file, the file needs to be shorter.**" |
| [GitHub Copilot](https://docs.github.com/en/copilot/tutorials/use-custom-instructions) | "Limit any single instruction file to a maximum of about 1,000 lines. Beyond this, the quality of responses may deteriorate." Two other Copilot pages give no cap at all. |
| [Cursor](https://cursor.com/docs/rules) | "Keep rules under 500 lines" — a best-practice bullet, not an enforced limit |

**None of them publishes an eval.** And the one paper that tested context-file length against outcome
found no correlation: *Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding
Agents?* ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988), v3 2026-09-29), 4 agent-model pairs over
438 task instances from 12 repositories. Resolve rate moved **−0.5%** on SWE-bench (p = 0.87) for
LLM-generated files and **+2.4%** on CTXbench (p = 0.21) for developer-written ones — **neither
significant** — while cost rose **over 20%**. One comparison in the paper *is* significant, and it is not
about length: developer-written files beat LLM-generated ones by **~7%** (p = 0.038). The length result
is Appendix B and Figure 13 rather than the abstract — "no correlation between the resolution rate and
the length of the context files". Repository overviews specifically did not help: agents reached the
patched files no faster. Specific instructions *were* obeyed — a named tool was used ~1.6× per instance
versus <0.01× when not named. Both this paper and Anthropic's docs conclude the same thing: what matters
is **specificity, not length**. The length claim rides on the specificity finding and is not
independently supported.

Against that, the one first-hand A/B anyone has published on this, with its own caveats:
[agents.md issue #260](https://github.com/agentsmd/agents.md/issues/260) (2026-11-02). 36 mined rules put
in AGENTS.md left recall at **0.19–0.22**, while **one line** about a known trap raised recall of missed
call sites from **0.667 to 0.917**. Naming the exact check commands plus one AGENTS.md line raised CI
format passes from **5/16 to 12/16** (sign test p = 0.016). One repository, 8–16 runs per arm, author is
one of the evidence doc's authors, not peer-reviewed. Its own finding on the agents.md position is the
sharper one: 20 sessions showed **9 of 13 commands never triggered** and **74.9% of configuration tokens
wasted on untriggered instructions** ([issue #213](https://github.com/agentsmd/agents.md/issues/213)).

**The measured context literature is about position, not volume, so none of it transfers to a volume
rule.** *Lost in the Middle* ([arXiv 2307.03172](https://arxiv.org/abs/2307.03172)) and Chroma's *Context
Rot* ([trychroma.com/research/context-rot](https://www.trychroma.com/research/context-rot), 18 models,
194,480 calls) report degradation with input length and from a single distractor, and publish their
effect sizes only in figures.

**Documentation drift: measured. Divergence between two copies: never measured.** Wen et al., ICPC 2019,
1,500 Java projects and 3,323,198 commits: co-evolution of code and comment happens in **7% of cases for
method comments and 13% for class comments**, and the authors explicitly refuse the inverse reading —
"This does not imply that in the remaining ~80% of cases code-comment inconsistencies are introduced, but
they represent a possibility." De Michele & Tantithamthavorn, APSEC 2026
([arXiv 2610.27381](https://arxiv.org/abs/2610.27381)): across 29,669 AI-generated pull requests in 2,585
repositories, a **63.2% documentation drift rate**, 55.2% for features and 77.5% for refactoring. The
closest work on duplication is RepliComment ([arXiv 2108.11205](https://arxiv.org/abs/2108.11205)), which
*counts* comment clones — 10 projects, >11,000 clone instances — at a point in time. **Nobody has
published a measured rate at which two copies of the same explanation diverge.**

## Checked, found nothing

So nobody repeats the search.

- **Diátaxis on agent readers.** Every page of diataxis.fr plus `/searchindex.js` and `/atom.xml`: zero
  hits for AI, LLM, agent, artificial, chatbot, GPT, generative. Zero for audience, persona, user groups.
  Don't retry `/complex-hierarchies/` — removed deliberately.
- **A named documentation-kinds framework for agents.** No spec, RFC or docs site publishes one. The
  Agent Skills spec and llms.txt both divide by cost, not need. Third-party Claude Code skills that
  re-encode Diátaxis exist; none is a primary source.
- **An official defence of the agents.md audience split.** [issue #130](https://github.com/agentsmd/agents.md/issues/130)
  challenges it head-on; no maintainer replied. There is no rebuttal to find.
- **"One or two pages" in Joel Parker Henderson's ADR templates repo** — 0 occurrences across 608 lines.
  The phrase is Nygard's alone, and it is verbatim in his 2011 post. `adr.github.io` and MADR give no
  page count at all.
- **Aider's "if your conventions file is large..." sentence** — not present in
  [the page](https://aider.chat/docs/usage/conventions.html) or its 2024-12-13 source. Only "a small
  markdown file". Don't quote it.
- **"Smallest possible set of high-signal tokens"** attributed to Anthropic — appears only in an agents.md
  issue comment, not on either Claude Code docs page.
- **Kubernetes has no prose gate and no record of trying one.** `.vale.ini` → 404; two nearest attempts
  ([website#54795](https://github.com/kubernetes/website/issues/54795),
  [website#7030](https://github.com/kubernetes/website/issues/7030)) both closed `lifecycle/rotten`.
  `prettier/prettier`, `microsoft/vscode`, `microsoft/TypeScript` run no prose linter either.
- **No post-mortems in Vale's own tracker.** 20 "false positive" issues, all narrow parser bugs, all
  closed as fixed. People who abandon a linter don't file an issue about it — `.vale.ini` commit
  histories are the honest instrument, and that is where most of §3 came from.
- **Zero-result searches:** `vale too noisy`, `stop blocking on docs lint`, `sunset vale`,
  `vale not worth`, `vale error to warning`, `prose lint does not block merge`, `COMMIT_LOG_TOO_LONG`,
  `remove proselint` / `drop proselint` / `disable proselint`, `revert markdownlint` /
  `remove markdownlint`, `disable textlint`. No gate removal at a notable project for proselint,
  markdownlint or textlint — only single-rule disables.
- **No textlint duplication rule exists.** `textlint-rule-no-duplicate-sentence`,
  `-no-duplicate-paragraph`, `textlint-rule-duplicate`, `textlint-rule-no-duplicate`: all 404 on npm.
- **No mechanism places the same prose in both a docs page and a source comment.** Transclusion within a
  docs tree is mature and converged (Sphinx `.. include::`, `pymdownx.snippets`, Antora `include::`,
  Hugo `os.ReadFile`). Only two mechanisms cross into source — Rust
  `#[doc = include_str!("../README.md")]`, resolved by the compiler and doctested, and Doxygen
  `\include{doc}` — and both are one-directional, file into source, so **a human reading the source sees
  a one-line reference, never the explanation**. If the duplication to avoid is the same explanation in
  an ADR and in a code comment, there is nothing to adopt.
- **An eval varying an instruction file's length while holding its content constant.** None exists.
  Searched arXiv and the agents.md tracker (all 134 issues). What *is* measured is a different question —
  many simultaneous constraints in one prompt, which collapses hard: *Instruction Stacking Collapse*
  ([arXiv 2608.02639](https://arxiv.org/abs/2608.02639)) reports follow rate falling from ~96% to as low
  as 20% as 24 verifier-checked instructions stack 1→20. Cite it as that, not as a length finding.

**Tooling notes.** `gitlab-org/gitlab` is not on GitHub; query GitLab.com's API, project `278964`, via
`repository/files/<url-encoded-path>/raw?ref=master` — the `commits?path=` endpoint 500s there, and issue
notes need a token. `gh search commits "remove vale"` is unusable (drowned in `valence`/`validation`); use
`gh api repos/<o>/<r>/commits?path=.vale.ini`. `openai/agents.md` now redirects to `agentsmd/agents.md`,
stewarded by the Agentic AI Foundation; `errata-ai/vale` is now `vale-cli/vale`, a real org migration by
its author, not an abandonment.
