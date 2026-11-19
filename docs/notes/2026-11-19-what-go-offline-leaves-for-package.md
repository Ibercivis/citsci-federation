<!-- Research note, not a decision. Measured 19 November 2026 on one developer machine. -->

# `go-offline` does not leave `package` offline

**Verdict.** `dependency:go-offline` does not fill the local repository. On
`broker/person-identifier`, `package` fetches 217 artifacts after `go-offline` has fetched 1088, and
`mvn --offline package` fails outright. So both Maven commands in each stage of `broker/Dockerfile`
reach Central, and `--quiet` is on the second of them.

**Read on only if** you are deciding whether `mvn package` should lose `--quiet` too, or costing
anything that assumes a Maven stage resolves once.

## The measurement

A fresh `maven:3.9.16-eclipse-temurin-21` container, empty `~/.m2`, the pom and `src/` mounted —
the same two commands the `mapper` stage runs, in the same order:

| command | artifacts downloaded |
|---|---|
| `org.apache.maven.plugins:maven-dependency-plugin:3.7.0:go-offline` | 1088 |
| `package`, after it | 217 |

Substituting `mvn --offline package` for the second command fails instead, on four provided-scope
jars that `go-offline` had not fetched — `jackson-dataformat-cbor`, `slf4j-api`,
`jakarta.xml.bind-api`, `commons-collections4`. The 217 are mostly poms, which is the shape of a
dependency graph being walked rather than a few jars being missed.

The loud step's own price, measured where it is paid: the first CI run without `--quiet` put 4340
`Downloading from central:` lines in the log — four `go-offline` invocations across the `tests` and
`base` jobs, about 1085 each, matching the table above. `issue #116` expected "a few lines of
download progress". The mechanism is what it predicted; the size is not.

## What it means

`issue #116` kept `--quiet` on `package` because "`package` on a warm repository prints almost
nothing worth having". The repository is not warm, so that reason does not hold: Central can refuse
this build at either command, and only the first one would say which request it refused.

What survives `--quiet` either way is the HTTP status, because Maven puts it in the `[ERROR]`
summary — a repository answering 401 prints `status code: 401` with `--quiet` and without. What
`--quiet` costs is the `[INFO] Downloading from central:` line that names the request, and the
`[WARNING]` that a pom came back absent. That is why the failure in `PR #101` could not be told
apart from a 403 or a 429: it named no status, which means the artifact was reported absent.

Nothing here argues for making the whole build loud. It argues that "one diagnosable step" is a
choice about which of two resolving commands is diagnosable, not a choice between resolution and
compilation.
