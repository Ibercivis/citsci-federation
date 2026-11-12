<!-- Research note, not a decision. The sources of truth about our design are `docs/specs/`,
`GLOSSARY.md` and `docs/adr/`; the rule this note examines lives in `docs/agents/external-repos.md`.
Nothing here has been adopted. Checked 12 November 2026; every liveness claim carries that date.
No production host was contacted for this note: every fact below comes from a local git clone, the
GitHub API, or a file in this repository. -->

# OpenRed's `main` is not a stale copy of the application — it is the application before a model rewrite

**Verdict.** Both halves of the question are true, and they are about different things. **The pilot's
cut is right and should not move**: `origin/main` has only `Measurement` and `Track` in
`measures/models.py` and one API route, `/api/measurements/`, while the live React front end and the
deployed hardware call `/api/radiation-measurements/`, `/api/stations/`, `/api/stats/`, `/api/tracks/`
and `/api/ingest/radiation/`, none of which exist on `main`; the sign-in code ADR-0007 asks us to
change — `dj_rest_auth`, `users/adapters.py`, `users/views_social.py` — exists **only** on
`feature/weather-cache-and-stats`. A `federation` cut from `main` would not be a behind-the-times
OpenRed, it would be a different application with no sign-in surface to integrate. **And the merge is
worth proposing to its maintainer, but it is not housekeeping**: the merge is not a fast-forward, it
costs six textual conflict hunks that are easy, and one migration-graph conflict in three Django apps
that is not — commit `eca37fc` (19 July 2025) deleted six already-applied migration files and
rewrote three `0001_initial`s, so the two branches hold two incompatible histories of the same
schema. Whether that merge is safe depends on what is in production's `django_migrations` table,
which this note could not read. **It is Francisco Sanz's call, not ours** — he is the sole active
committer and the only GitHub account with commits in either repository.

**Read on only if** you are deciding where `federation` is cut from (§1, §5 — and §5 is the section
that decides it); drafting the proposal to the maintainer (§2, §6, §7); wondering whether this is one
repository's accident or how Ibercivis works (§3 — it is the accident, with one caveat); looking for
what production follows (§4, and its open question); or chasing the "endpoint on an unmerged branch"
sentence in `docs/local-development.md` (§5.3 — measured and settled; the endpoint is served).

## 1. The shape of the divergence

**Counts.** Nineteen commits of divergence, in both directions, from a merge base of 15 May 2025.

```sh
# in /Users/cacaguate/ibercivis/OpenRed, after git fetch origin --prune
git merge-base origin/main origin/feature/weather-cache-and-stats
# 01593ac0cd305b9ffba4a2adb35da106d07dd9f8  (2025-05-15, Alfredo Ferrer)
git rev-list --count origin/main..origin/feature/weather-cache-and-stats   # 18
git rev-list --count origin/feature/weather-cache-and-stats..origin/main   #  2
```

So **a merge into `main` would be a real merge, not a fast-forward.** `main` does hold two commits
the feature branch lacks.

**Tips, `git log -1 --date=iso` on each remote ref:**

| Ref | Tip | Date | Author |
|---|---|---|---|
| `origin/main` | `2491707` | 2025-07-29 | Alfredo Ferrer |
| `origin/feature/weather-cache-and-stats` | `e66a6c9` | 2026-11-09 | Francisco Sanz |
| `origin/federation` | `e66a6c9` | 2026-11-09 | — (same commit; the pilot has added nothing yet) |
| `origin/local-dev-environment` | `a7e624a` | 2026-11-11 | Alberto Gualis |

`main` has had **no commit for 15 months and 14 days**. The feature branch has commits in July,
November and December 2025 and in February, September, October and November 2026 — `git log
--pretty='%h | %ad | %an | %s' --date=short origin/main..origin/feature/weather-cache-and-stats`.

**What the feature branch's 18 commits contain.** Taken from their own subject lines and
`--stat`: the model rewrite (`a8a328f` "Antes del cambio de modelo", `eca37fc` "Terminado por hoy",
both 19 July 2025), gunicorn (`b217774`), `2393ed1` "Track ingest hardening, RCTRK Android/iOS
parsing, reports, milestones, **weather cache**", the RCTRK parser work, the GHS-SMOD urban class and
light-area summary email, the periodic-email machinery with its own `openred-emails` RQ queue and
scheduler, idempotent track upload by `clientTrackId`, a ZIP export of a volunteer's own tracks, and
`69eb384` "Endpoint `compact/` para lecturas masivas de medidas y bbox con intersects". Thirty-one
new `measures` migrations, two new `devices` migrations and four new `missions` migrations come with
them.

**What `main` holds that the feature branch lacks** — this is the whole of it, and it is small:

- `0214adf` (Alfredo Ferrer, 2025-07-29), "User Groups and heatmap on Client": a `UserGroup` model
  with its admin, form and views in the `missions` app, `missions/migrations/0002_alter_campaign_participants_usergroup_and_more.py`,
  and 131 changed lines in `frontend/static/frontend/js/map.js`. `git grep -n UserGroup
  origin/feature/weather-cache-and-stats` returns **nothing**, so this is genuinely unique work.
- `2491707` (same author, same day, same subject): deletes a single line from `openred/settings.py`.
  The feature branch does not contain that line either, so nothing is lost by not merging it. What
  the line was is not recorded here — `docs/agents/security-findings.md` keeps that off public
  surfaces — and it is immaterial to the branching question.

One qualification on the heatmap half of `0214adf`: on the feature branch `openred/urls.py` no longer
includes `frontend.urls` at the root, so the Django-template front end main's heatmap lives in is no
longer routed by the live application. The `UserGroup` half is real work with nowhere to be; the
heatmap half is work on a component the application appears to have left behind. **Inference**, from
the URLconf, not from a running site.

### 1.1 The migration histories are not two branches of one graph

This is the finding that decides how hard the merge is.

```sh
git diff --name-status 01593ac origin/feature/weather-cache-and-stats -- '*/migrations/*'
```

Six files are `D`, three `0001_initial.py` are `M`, all in commit `eca37fc` (19 July 2025, confirmed
with `git log --diff-filter=D`). The feature branch **deleted** `devices/0002_alter_device_hash`,
`devices/0003_devicemodel_description_devicemodel_technology`, `devices/0004_devicemodel_picture`,
`devices/0005_devicemodel_validatedbyopenred`, `measures/0002_track` and
`measures/0003_track_campaign_track_device`, and folded their effect back into the initial
migrations: `devices/0001_initial` on the feature branch creates `technology`,
`validatedByOpenRed`, `description` and `picture` on `DeviceModel` directly, and
`missions/0001_initial`'s dependency changed from `('devices', '0005_devicemodel_validatedbyopenred')`
to `('devices', '0001_initial')`.

Content-wise nothing was lost — the squash is faithful. Graph-wise, the two branches now number the
same slots differently in three apps:

| App | `main` | `feature/weather-cache-and-stats` |
|---|---|---|
| `devices` | `0002_alter_device_hash` … `0005_devicemodel_validatedbyopenred` | `0002_device_ingest_token_created_at_and_more`, `0003_device_created_at_device_updated_at` |
| `measures` | `0002_track`, `0003_track_campaign_track_device` | `0002_enable_h3_extension` … `0032_track_client_track_id` |
| `missions` | `0002_alter_campaign_participants_usergroup_and_more` | `0002_add_project_and_created_by_to_mission` … `0005_add_campaign_password` |

### 1.2 What a merge would actually hit, tested

```sh
git merge-tree --write-tree --name-only origin/main origin/feature/weather-cache-and-stats
```

Written tree `384be27`. Five files conflict, **six hunks in total** (counted by `git show
384be27:<path> | grep -c '^<<<<<<<'`):

| File | Hunks |
|---|---|
| `frontend/static/frontend/js/map.js` | 1 |
| `missions/admin.py` | 1 |
| `missions/models.py` | 1 |
| `missions/views.py` | 2 |
| `openred/settings.py` | 1 |

`frontend/templates/frontend/index.html` auto-merged. **The text is the easy part.**

The part git cannot see is in the merged tree's file list: it contains **two** `missions/0002_*`
migrations, both declaring `dependencies = [… ('missions', '0001_initial')]`, so the `missions` app
would have two leaf nodes and `manage.py migrate` would refuse with Django's "Conflicting migrations
detected" until somebody runs `makemigrations --merge`. Both of them also carry an `AlterField` on
`campaign.participants`, so the merge migration's ordering decides which field definition the model
state ends up with — resolvable, but a decision rather than a formality.

Main's deleted `devices` and `measures` migrations do **not** come back in the merged tree (git
resolves delete-vs-untouched in favour of the delete), which is the right answer and worth knowing
before anyone is surprised by it.

## 2. Repository signals about intent

All from the GitHub API, 12 November 2026.

- **Default branch is `main`**, repository public, not archived, created 2024-10-02
  (`gh api repos/Ibercivis/OpenRed`).
- **No branch protection anywhere.** `gh api repos/Ibercivis/OpenRed/branches` reports
  `protected=false` for all four branches; `gh api repos/Ibercivis/OpenRed/branches/main/protection`
  returns `404 Not Found`.
- **No tags and no releases**: `gh api repos/Ibercivis/OpenRed/tags -q length` → `0`, same for
  `/releases`. There is nothing on `main` that anything else points at.
- **One pull request has ever existed in this repository, and it is ours.**
  `gh pr list --repo Ibercivis/OpenRed --state all --limit 100` returns exactly `#1 OPEN
  local-dev-environment -> federation | agualis | 2026-11-11`. **No PR has ever proposed merging the
  feature branch into `main`** — not open, not closed, not merged. There is no recorded intent either
  way, and no discussion to read. `gh issue list --repo Ibercivis/OpenRed --state all` returns
  nothing either.
- **`Django CI` has never run.** `.github/workflows/django.yml` is byte-identical on both branches
  (`git diff origin/main origin/feature/weather-cache-and-stats -- .github/workflows/django.yml` is
  empty) and triggers on `push`/`pull_request` to `"main"` only. All 11 workflow runs the API reports
  are `dynamic/github-code-scanning/codeql` on `main`, the last on 2026-01-20. So the live branch is
  tested by nothing and scanned by nothing, and CodeQL's findings — such as they are — describe July
  2025 code.
- **Committers.** `git shortlog -sne origin/feature/weather-cache-and-stats`: Francisco Sanz under
  three addresses (45 + 13 + 3 commits), Alfredo Ferrer `<aferrer@kampal.com>` (1). On `main`:
  the same three Sanz identities (43) and Alfredo Ferrer (3). `gh api
  repos/Ibercivis/OpenRed/contributors` lists **one** login, `frasanz`; `gh api
  repos/Ibercivis/OpenRed/commits/2491707` returns `author.login: null` for Alfredo Ferrer, so his
  commits are not attached to any GitHub account. Since 2025-08-01 the only committer is Francisco
  Sanz (`git shortlog -sne --since=2025-08-01`).

**So every commit on `main` that the feature branch lacks is by the one contributor who has not
touched the repository since 29 July 2025**, and every commit since is by the one who has.

### 2.1 `frasanz/openred-react` does not show the split

| | |
|---|---|
| Default branch | `master` (`gh api repos/frasanz/openred-react`) |
| Branches | `master`, `federation`, `local-dev-environment` |
| `master` vs `federation` | **identical**, both `8a91162`, 2026-11-03, Francisco Sanz |
| `master..federation` / reverse | 0 / 0 commits |
| PRs, all states | one, ours (`#1 local-dev-environment -> federation`, 2026-11-12) |
| Workflow runs | `0` |
| Contributors | one login, `frasanz` |

The front end's live line **is** its default branch. The same author who works on a long-lived
branch in the API commits straight to `master` here. Two consequences:

1. The split is specific to the API repository, not to the person or to the project.
2. `openred-react` is a **personal** repository, not an organisation one — which is already tracked
   as issue #35 in this repository, "Move `openred-react` into the Ibercivis organisation", and is a
   separate conversation from this one.

Dating matters here: `openred-react` was created **2025-11-07**, three months after `main` stopped.
The entire live front end was written in the window during which `main` was frozen, and it calls
`.../compact/` (`src/services/measurements/BaseMeasurementService.ts:74`,
`src/hooks/useMeasurementsByZoom.ts:322`, `src/services/api.ts:523`,
`src/pages/TracksPage.tsx:242`) — an endpoint that exists nowhere on `main` (`git grep -n compact
origin/main -- '*.py'` is empty). Its `package.json:61` carries `"proxy": "https://api.open-red.es"`.

## 3. OpenRed is the exception, not the rule — with one caveat

`gh api repos/Ibercivis/<repo>/branches` and `gh api repos/Ibercivis/<repo>/compare/main...<branch>`,
12 November 2026:

| Repository | `main` tip | Is `main` the live line? | Shape |
|---|---|---|---|
| `Ibercivis/gdalface` | `99c560a`, 2025-12-04, Francisco Sanz | **Yes.** The only other branches are five stale dependabot branches, each 1 ahead and 19–27 behind, all from 2024–early 2025 | 27 PRs, 11 merged into `main` |
| `Ibercivis/citsci-api` | `347f4df`, **2026-11-11**, Francisco Sanz | **Yes.** Nine of ten non-pilot branches are `behind` or `identical`; only `social-login-email-linking` is 1 ahead, from 2026-11-04 | feature branches land and are left behind |
| `Ibercivis/Geonity` | `a56caca`, 2026-11-06, "Merge pull request #31 from Ibercivis/feat/image-compression" | **Yes.** All ten non-pilot branches are `behind` | 11 merged PRs into `main`; a real PR workflow |
| `Ibercivis/OpenRed` | `2491707`, **2025-07-29** | **No** | 1 PR ever, ours |

In all three siblings, the pilot's `federation` branch sits on `main`'s exact tip — `99c560a`,
`347f4df`, `a56caca` — which is the rule in `docs/agents/external-repos.md` working as written.
Geonity even merges through pull requests. **The pattern "stale `main`, real work on a long-lived
unmerged branch" occurs in exactly one of the four repositories.** The pilot is looking at one
repository's accident, and the accident has a cause: a model rewrite in July 2025 that was never
merged back, by a contributor who then left the repository, in a repo with no PR, no protection and
no release process to force the question.

**The caveat, and it is worth a line.** The pilot's own internal server survey records that at least
one other Ibercivis application is deployed from a feature branch rather than from its default
branch, and that branch is not among the branches GitHub lists for that repository — so it exists
only on the server. (Source read for understanding, not quoted: `docs/private/servicios.md`, which is
gitignored.) **Deploying from a branch is therefore a local habit, not unique to OpenRed.** What is
unique to OpenRed is that the branch is public, is 18 commits of real work, and has left `main`
describing a previous version of the data model. If `federation` is ever to be cut from `main` in
every repository without a caveat, that other case needs its own check — not in scope here.

## 4. What the deploy appears to follow

**Committed evidence pins nothing, and most of what looks like deployment configuration is not.**

- **`.github/workflows/django.yml`** is the only committed CI in either repository. It names `main`
  in its triggers, identically on both branches, and has never run (§2). It installs requirements
  and runs `manage.py test` — it deploys nothing.
- **`deploy/supervisor/openred-emails.conf`** and **`deploy/supervisor/openred-rq-scheduler.conf`**
  exist only on the feature branch and are real: supervisor program definitions for the
  `openred-emails` queue and the RQ scheduler, with install instructions in their comment headers.
  **They name no branch.**
- **`docs/deployment/production-setup.md:401`**, on the feature branch, is the only committed line in
  either repository that names a branch in a deployment step: `git pull origin main`, inside an
  "Update Application" runbook. **Treat it as weak:** the same file's paths disagree with the
  supervisor files committed beside it on the same branch, and the document reads as generated
  boilerplate rather than a transcript of the machine. It is evidence that a document says `main`,
  not evidence that anything pulls `main`.
- **`openred-react/README.md` §6** documents a Docker deployment, a `docker-compose.yml` and a
  `.github/workflows/deploy.yml` triggered on `main`. **None of those three files exists in the
  repository** (`git ls-tree -r --name-only origin/master | grep -iE '\.github|docker|deploy'`
  returns only three shell helpers), and the repository's default branch is `master`, not `main`.
  Aspirational documentation; no evidential value.
- No Dockerfile, compose file, Makefile, fabfile or ansible directory is committed on either branch
  of either repository. The pilot's Dockerfile and `compose.yaml` on `local-dev-environment` are
  ours and are for the composition of ADR-0009, not for production.

**What this repository already records**, read for understanding and stated here as a conclusion
without the infrastructure detail (`docs/private/servicios.md` and `docs/private/openred-map-deploy.md`,
both gitignored, neither quoted): the pilot's own survey of the production machines, dated 2026,
records the **OpenRed API's production checkout as sitting on `feature/weather-cache-and-stats`**,
and already flags, among the things it wants reviewed, that more than one application is deployed
from a feature branch. For the
**web/map front end** it records something different and more awkward: the served directory is not a
checkout at all, so no branch is being followed there and nothing in production would need
re-pointing; the planned procedure builds from `master`, which is the same commit as `federation`.

That is a record of what the survey found, and it is consistent with everything in §1 and §5. It is
not a reading of the server taken for this note. **The two things that genuinely need the host are in
§8.**

## 5. What a merge would cost the pilot, and what it would buy

### 5.1 `main` is not the same application

This is the decisive evidence and it is four commands.

```sh
git show origin/main:measures/models.py | grep -n '^class'
# 6:class Measurement(models.Model)
# 31:class Track(models.Model)
```

That is all of it. `RadiationMeasurement`, `LightPollutionMeasurement`, `Spectrum`, `Station` and
`WeatherCache` do not exist on `main` (`git grep -c 'class <Name>' origin/main --
'measures/models.py'` → `0` for each), and neither does `missions.Project` (`git grep -n 'class
Project' origin/main` → nothing; on the feature branch it is `missions/models.py:4`).

```sh
git show origin/main:measures/urls.py
# router.register(r'measurements', MeasurementViewSet, basename='measurement')
```

One route. The feature branch registers `radiation-measurements`, `light-pollution-measurements`,
`tracks`, `radiation-spectra`, `stats`, `stations`, `measurements`, and
`path('ingest/radiation/', RadiationIngestView.as_view())`. The React front end calls the first set;
the ESP32 firmware committed in `openred-react/firmware/*/manifest.json` names
`https://api.open-red.es/` as its home page. **`main` could serve neither the live front end nor the
deployed devices.** The commit message `a8a328f`, "Antes del cambio de modelo", says the same thing in
four words.

### 5.2 The code ADR-0007 asks us to change is on the feature branch and nowhere else

`git diff --stat origin/main origin/feature/weather-cache-and-stats -- users openred/settings.py`:

| Path | Lines |
|---|---|
| `openred/settings.py` | 513 |
| `users/tests.py` | 1117 |
| `users/views.py` | 232 |
| `users/serializers.py` | 172 |
| `users/adapters.py` | 167 (**new on the feature branch**) |
| `users/views_social.py` | 42 (**new**) |
| four `users/management/commands/*_google_oauth*.py` | 397 (**new**) |

The settings diff adds `dj_rest_auth` and `dj_rest_auth.registration` to `INSTALLED_APPS`, an
`ACCOUNT_ADAPTER = 'users.adapters.EmailUsernameAdapter'`, a `SOCIALACCOUNT_ADAPTER =
'users.adapters.AutoConnectSocialAccountAdapter'`, `SOCIALACCOUNT_AUTO_SIGNUP = True` and a
`REST_FRAMEWORK` block. The feature branch's `openred/urls.py` routes
`dj-rest-auth/`, `dj-rest-auth/registration/` and `dj-rest-auth/google/`; `main`'s routes none of
them.

Issue #30's acceptance criteria are "delegates authentication to the Broker", "its own sign-in for
existing accounts keeps working **exactly** as before", "the registration link in the web frontend is
closed". **On `main` there is no API registration endpoint to close and no social-auth adapter to hook
into.** The integration would have to be invented against code that is not deployed, and then
re-done against the code that is.

### 5.3 Re-cutting `federation` from `main` would break the local environment outright

`git diff --stat origin/federation origin/local-dev-environment` — twelve files, 7,707 insertions.
Three of them are fatal on `main`:

- `measures/management/commands/seed_local.py` (1,103 lines) imports
  `LightPollutionMeasurement, RadiationMeasurement, Spectrum, Station, Track, WeatherCache` from
  `measures.models` and `Campaign, Mission, Project` from `missions.models`. Six of those nine
  names do not exist on `main` (§5.1). The seed command would not import.
- `measures/migrations/0002_enable_h3_extension.py` is patched by the pilot (80 changed lines, the
  fix that lets the h3 extension fail softly). **That file does not exist on `main`** — `main`'s
  `measures/0002` is `0002_track`.
- `openred/settings.py` (51 changed lines) is patched on top of the feature branch's settings, which
  are 513 lines different from `main`'s.

So the cost of re-cutting from `main` is not "adjust a few paths": it is the whole local environment,
plus the dataset, plus `docs/local-development.md`'s OpenRed section. And the result would be an
environment for an application nobody runs.

**One correction this investigation turned up.** `docs/local-development.md` says OpenRed's map
"reads an endpoint that exists only on an unmerged branch, left unmerged deliberately", and
`LOCAL-DEV.md` on `origin/local-dev-environment` says `…/compact/` "exists only on the unmerged
`origin/feature/weather-cache-and-stats`, commit `69eb384` … so the map stays empty". The first half
is true **with respect to `main`**. The second half does not follow: `69eb384` is an ancestor of both
`origin/federation` and `origin/local-dev-environment` (`git merge-base --is-ancestor 69eb384
origin/local-dev-environment` → exit 0), `measures/compact.py` is in the tree of
`origin/local-dev-environment`, and `measures/urls.py` there registers
`radiation-measurements`, so `/api/radiation-measurements/compact/` **is** present in the local
environment's backend. The likeliest explanation is that the text was written against an earlier base
and not re-checked after the branch was cut from `e66a6c9` (9 November) on 11 November.

**Since measured, and settled.** Against the running local environment on 12 November 2026, both of
the map's data paths answer `200` with seeded rows, for both measurement domains:

```sh
curl -s http://localhost:8020/api/radiation-measurements/compact/
# {"fields":["id","lat","lon","dose_rate"],"rows":[[1,43.055538,-7.555707,0.10479], …
curl -s http://localhost:8020/api/radiation-measurements/h3-aggregation/
# {"resolution":8,"hexagons":[{"h3_index":"88397050adfffff","measurement_count":396, …
```

`…/light-pollution-measurements/` answers the same on both paths. Which one the map asks for depends
on zoom: `openred-react/src/hooks/useMeasurementsByZoom.ts:322` calls `…/compact/` at zoom ≥ 15 and
`getH3Aggregation` below it, so neither the H3 extension nor the compact endpoint is what empties the
map. What remains blank is the Mapbox basemap, which needs a `pk.` token
(`openred-react/src/components/StationMapPicker.tsx:9`) and is already documented above as expected
and not a defect. `docs/local-development.md` is corrected; the application's `LOCAL-DEV.md` still
carries the wrong reason. "Deliberately not merged" is the right description of the pilot's stance
towards `main`, not of the endpoint's absence from `federation`.

### 5.4 What the merge would buy

Nothing the pilot needs, and three things the application would gain:

1. **`Django CI` and CodeQL would start seeing the live code.** Both follow `main` (§2); today they
   watch a branch nobody runs. This is the strongest argument for the merge and it has nothing to do
   with us.
2. **`UserGroup` would stop being orphaned.** It is the only feature in the repository that exists
   and is reachable from no deployed code path (§1).
3. **`git log --oneline origin/main..federation` would mean what `docs/agents/external-repos.md` says
   it means** in every repository, with no exception paragraph. Today the exception is written down
   and honoured, which is the next best thing.

None of the three is worth the pilot spending its own time on, and none of them is blocked by the
pilot's cut.

## 6. Whose decision it is

**The pilot can decide alone:** where `federation` is cut from, what lands on it, and what the local
environment is built against. `docs/agents/external-repos.md` already owns that choice and already
records this deviation. Nothing in §1–§5 touches production.

**The pilot cannot decide:** whether `feature/weather-cache-and-stats` merges into `main`, whether
`main` becomes the deployed branch, or whether the production checkout changes branch. That is
someone else's production application, running on someone else's schedule, with a database whose
migration state we have not read.

**Who decides.** On the public record: **Francisco Sanz** (`frasanz`), author of 61 of the 62
commits on the feature branch, sole committer since August 2025, sole contributor the GitHub API
reports for either repository, and owner of the personal account `openred-react` sits under.
**Alfredo Ferrer** (`aferrer@kampal.com`, no GitHub account attached to his commits) authored every
commit on `main` that the feature branch lacks and has not committed since 29 July 2025 — so he is
the person who would know whether `UserGroup` was ever finished or wanted, and nobody else can
answer that.

**The proposal, if it is made, is one request and one offer:** that the branch be merged into `main`
so that CI and code scanning follow the live code, and that we can describe the migration-graph
conflict and the six conflict hunks precisely (§1.1, §1.2) because we have already measured them.
Not "your repository is set up wrong".

## 7. Recommendation — separate from the evidence above

1. **Leave `federation` cut from `origin/feature/weather-cache-and-stats`.** §5.1 and §5.2 settle it
   on their own: on `main` there is no sign-in surface to integrate, no data model the front end
   speaks to, and no local environment. This is not a tolerated deviation, it is the only cut that
   describes OpenRed. `docs/agents/external-repos.md` should keep saying so.
2. **Strengthen one sentence of that rule, without changing it.** Its current reason is "`main` has
   not been deployed in over a year". The better reason is "`main` predates a model rewrite: it has
   neither the data model nor the sign-in path the integration changes". One is about staleness; the
   other cannot be argued with. Same decision, firmer footing.
3. **Propose the merge to Francisco Sanz as housekeeping that is his, not ours**, and say the three
   things we know that he may not: CI and CodeQL have never seen the live branch; `UserGroup` and the
   template-frontend heatmap on `main` are the only work that would be lost by abandoning `main`
   instead of merging it; and the merge is six easy conflict hunks plus a Django leaf-node conflict in
   `missions` that needs `makemigrations --merge` and a decision about `campaign.participants`.
   Offer the measurements, not the commit. **Do not open the PR ourselves** — ADR territory aside, we
   cannot test the result against production's migration state.
4. **Do not propose repointing the deployment.** Changing which branch a running application is
   deployed from is a separate, riskier act than merging, it buys the pilot nothing, and it should
   follow a merge by weeks, if at all. If it ever happens, `federation` is re-cut from `main` that
   day and the local environment is rebuilt — and by then it would be rebuilt against code that is
   identical to today's feature branch, so the cost is a rebase, not a rewrite.
5. ~~**Correct the two documents in §5.3** after one run of the local environment.~~ Done for
   `docs/local-development.md` on 12 November 2026. The application's `LOCAL-DEV.md` is still to do,
   and because it lives in an external repository it goes by a topic branch and a pull request with
   `--base federation`, not by an edit.

**The condition under which recommendation 1 flips:** `feature/weather-cache-and-stats` merges into
`main` and the merge commit becomes an ancestor of `main`'s tip. On that day `main` is a superset of
what `federation` is cut from, the `federation` branch is re-cut from `main`'s latest commit, the
exception paragraph in `docs/agents/external-repos.md` is deleted, and the pilot's diff
`origin/main..federation` becomes pilot work only, as everywhere else. Nothing else flips it: not the
feature branch being renamed, not `main` receiving unrelated commits, and not production moving to
`main` without a merge — if production ever followed `main` without the merge, the application would
have changed, not the branch policy, and the integration would have to be re-examined from §5.1
upwards.

**Recommendations 1 and 3 are not in tension, and that is the whole answer to the question asked.**
The pilot's cut is correct as it stands *and* the merge is worth proposing. They are compatible
because the cut is a statement about where OpenRed's code is today, and the merge is a request about
where it should live tomorrow.

## 8. Open questions

The first two need the production host and are the user's to answer or delegate; this note did not
contact any server. **All of them are now tracked**: questions 1 and 2 as issue #37, question 5 as
issue #38, and the pilot's own share of the dependency question as issue #39. The text below is kept
as the reasoning behind each; the tickets carry the work.

1. **What is in production's `django_migrations` table?** This is the one question that could change
   recommendation 3 into "do not merge yet". The database has existed since 2024, so it was almost
   certainly migrated along `main`'s path to July 2025 and then along the feature branch's after
   `eca37fc` deleted six of those migration files — meaning it holds rows for migrations that no
   longer exist, and has never applied `missions/0002_alter_campaign_participants_usergroup_and_more`.
   That migration's operations are mostly additive and would probably apply cleanly, but "probably" is
   not a thing to tell a maintainer. *Answered by*: one read-only `SELECT app, name FROM
   django_migrations ORDER BY app, name;` on the production database, and `manage.py showmigrations`.
   Both are read-only diagnosis, which needs no permission — but they need access to the host, which
   this note was scoped out of.
2. **Was the production database ever reset or rebuilt after July 2025?** If it was, question 1
   becomes trivial. Nothing committed says. *Answered by*: the same read, plus the backup directory's
   dates.
3. **Was `UserGroup` ever finished, deployed or wanted?** It is the only thing a decision not to merge
   would discard. *Answered by*: Alfredo Ferrer (`aferrer@kampal.com`), who wrote it, or Francisco
   Sanz. Not answerable from the repository: there is no PR, no issue and no tag.
4. ~~**Does the local environment's map actually stay empty, and if so why?**~~ **Answered on
   12 November 2026**: both of its data paths serve the seeded rows, and only the Mapbox basemap is
   blank, which was already expected. See §5.3. `docs/local-development.md` is corrected; the
   application's `LOCAL-DEV.md` is not yet.
5. **Is the other repository deployed from a server-only branch a problem for its `federation` cut?**
   §3's caveat. Its `federation` sits on `main`'s tip, which is also the newest commit in that
   repository, so the shape is not OpenRed's — but "production is on a branch GitHub has never seen"
   deserves its own look before the composition of ADR-0009 claims to mirror what is deployed.

   **Half answered on 12 November 2026, and it got worse rather than better.** That branch is not on
   the remote at all: `gh api repos/Ibercivis/gdalface/branches` returns only `federation`,
   `local-dev-environment`, `main` and five `dependabot/pip/*` branches. So either it was deleted
   after deployment, leaving production on a commit GitHub no longer names, or the inventory that
   records it is stale. The `federation` cut is unaffected either way — it is `main`'s tip — but
   ADR-0009's mirror claim is not. Tracked as issue #38; *settled by* a read of that production
   checkout, which still needs the host.
