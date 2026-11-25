<!-- Research note, not a decision. Read against dependabot-core `main` on 19 November 2026.
     Only the name-keying is observed against the hosted service; the rest is read from source. -->

# One Dependabot entry over two compose files sees one set of pins, not two

**Verdict.** Every compose file an update entry reads is parsed into one `DependencySet` keyed by
the bare image name. `postgres:18-alpine` in `compose.yaml` and `postgres:16` in
`compose.apps.yaml` are therefore **one dependency called `postgres`**: one pull request rewrites
both files, each along its own tag track, and `ignore: dependency-name: postgres` silences both.
The split `issue #139` is after cannot be expressed inside a single entry at `/`. `exclude-paths`
drops a whole file; a second entry on the same directory is unsupported. Moving a file into a
subdirectory of its own is the only configuration that separates two files' pins.

**Read on only if** you are changing `.github/dependabot.yml`, or a bump you expected never
arrived.

## Which files one entry reads

`docker/lib/dependabot/docker_compose/file_fetcher.rb` selects by one regex, unanchored and
case-insensitive, against the names in the single directory it was pointed at:

    FILENAME_REGEX = /(docker-)?compose(-[\w]+)?(?>\.[\w-]+)?\.ya?ml/i

Unanchored, so it is a substring test. `compose.apps.yaml` matches, and so do `my-compose.yaml`
and `compose.yaml.bak`; `compose_apps.yaml` and `compose.a.b.yaml` do not. No recursion, and the
parser follows neither `include:` nor `extends: file:`, so one entry at `/` sees root-level compose
files and nothing else.

**Do not use this to hide a file.** Renaming `compose.apps.yaml` so the regex misses it works
today and leans on undocumented behaviour that would break silently if upstream widens the
pattern.

## Why name-collapsing does not hide a bump

This refutes the hypothesis `issue #139` was filed with. Identity is the image name alone —
`build_dependency` sets `name: details.fetch("image")`, and `Dependabot::Dependency` has no
top-level file attribute; the file lives only inside each requirement. But the merge keeps the
**lower** of the two versions (`DependencySlot#combined_version` returns the minimum, and prefers a
comparable tag over a non-comparable one), so the outdated pin is what drives the update check. A
current pin cannot mask an outdated one by sitting in another file.

What follows is per requirement, not per dependency: `Docker::UpdateChecker#updated_requirements`
computes `latest_version_from(tag)` from each requirement's own tag, and `SharedFileUpdater`
rewrites each file from the requirements whose `file` matches it. So `16` moves to a newer plain
tag while `18-alpine` moves along the `-alpine` track, in one pull request. The 2020 reports of
both files being forced to the same tag (dependabot-core #2063, #2179) were refuted on
verification: PR #5560 fixed that in 2022.

**Observed here.** PR #131 rewrites all three `redis:7-alpine` pins in `compose.apps.yaml` —
LostAtNight's, Geonity's and OpenRed's — in one pull request, because they are one dependency named
`redis`. There is no accepting one application's Redis bump and declining another's.

Two residual ways the single merged version can still gate everything: both tags non-comparable,
or a digest-pinned instance mixed with a tag-pinned one, since `digest_requirements.any?` is
evaluated across the merged dependency. Same-image-different-suffix conflation is a live bug class
(#11215, PR #13842) that ends in `No files changed!`.

## `exclude-paths`

It reaches this ecosystem. The matcher is `Dependabot::FileFiltering.exclude_path?`, which names
no ecosystem, and the base fetcher runs `filter_excluded` on the directory listing **before**
`FILENAME_REGEX` sees an entry. The compose fetcher discovers files only through that listing, so
it cannot leak the way `fetch_file_if_present` does for pip/uv (#16388).

- A bare `compose.apps.yaml` is the correct pattern for a root file. `**/compose.apps.yaml` matches
  **nothing** at the root — verified by executing `File.fnmatch?`.
- Wildcards can cross `/`: the first of four flag sets is `FNM_EXTGLOB` without `FNM_PATHNAME`, so
  the patterns are more permissive than the docs' examples suggest.
- **Version updates only.** Security update pull requests still arrive for an excluded file
  (#14408, open), and so do alerts (#15148, open).
- GitHub Docs says patterns are relative to the entry's `directory`; the launch changelog and the
  code say repository root. Moot at `directory: "/"`.
- Announced 26 August 2025, still behind the flag `enable_exclude_paths_subdirectory_manifest_files`
  with per-ecosystem plumbing open (#13013). The youngest thing here, and the likeliest to move.

To confirm an exclusion took effect, read the job log for `filter_excluded: Filtered from N to M
entries`. A dry run is weaker evidence — the dry-run path has had its own exclusion bugs (#12898).

## `ignore` granularity, and two entries on one directory

`ignore` takes `dependency-name`, `versions` and `update-types`. No path key, no file key, and
`directory` cannot name a file: dependabot-core #2179 is the long-running request for per-file
targeting, closed in 2022 as fixed by PR #5560, which fixed something else. For this ecosystem the
restriction binds twice over, because two files pinning one image are one dependency by name.

Two entries sharing `package-ecosystem` **and** `directory` are not supported — GitHub Docs asks
for "no overlap in directories defined" — but **what actually happens is unknown**: every claim
about the failure mode failed verification, and the `target-branch` workaround circulating in
#1778 was refuted outright. A throwaway public repo would settle it in one commit.

`directories` expands to one job per directory, which is why the `docker` entry over `/broker` and
`/mock-identity-source` bumps the `node` pin they share twice.

## Still open: `postgres` produced no pull request at all

The code above predicts one — `postgres` merged at `16`, requirements recomputed per file, so
`compose.apps.yaml:140` moves and `compose.yaml` stays. None was opened on 19 November 2026, and
that is now an anomaly against the engine rather than the expected behaviour the ticket assumed.
The job log for the `docker-compose` entry is where the answer is; `No files changed!` from the
suffix-conflation class above is the first suspect.

## Sources

- `docker/lib/dependabot/docker_compose/{file_fetcher,file_parser}.rb`,
  `docker/lib/dependabot/shared/{shared_file_parser,shared_file_updater}.rb`,
  `docker/lib/dependabot/docker/{update_checker,tag,version}.rb`
- `common/lib/dependabot/file_parsers/base/dependency_set.rb`,
  `common/lib/dependabot/file_filtering.rb`, `common/lib/dependabot/file_fetchers/base.rb`
- <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>
- <https://github.blog/changelog/2025-08-26-dependabot-can-now-exclude-automatic-pull-requests-for-manifests-in-selected-subdirectories/>
- dependabot-core PRs #5560, #5801, #12532, #13842; issues #1778, #2063, #2179, #11215, #12898,
  #13013, #14408, #15148, #16388
