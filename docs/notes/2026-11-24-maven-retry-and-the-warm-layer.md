<!-- Research note, not a decision. Measured 24 November 2026 on one developer machine. -->

# Maven's 429 retry, and what a warm dependency layer costs

**Verdict.** Two measurements behind `issue #183`. The resolver in our image reads
`aether.connector.http.retryHandler.*`; the `aether.transport.http.*` in its own documentation is
resolver 2.x and takes no effect here, silently. And `package` run on a pom with no sources yet
warms the layer completely: after it, `mvn --offline package` on the real sources succeeds, for 768
requests to Central per stage where `dependency:go-offline` took 1296 and left `package` resolving.

**Read on only if** you are moving the retry configuration, pinning the Maven image somewhere else,
or costing a build sequence against these rows.

## 1. The retry, and the property name that reaches it

A server answering **429 to everything** and logging when each request arrived, mirrored over `*` in
a settings file, inside `maven:3.9-eclipse-temurin-26` — Maven 3.9.16, maven-resolver 1.9.27 — asked
for `maven-dependency-plugin:pom:3.7.0`, the artifact CI's failures land on.

| configuration | requests | gaps between them |
| --- | --- | --- |
| defaults | 4 | 5 s, 10 s, 15 s — 30 s in total |
| `aether.transport.http.retryHandler.count=5`, `interval=1000`, `intervalMax=2500` | 4 | 5 s, 10 s, 15 s — unchanged |
| `aether.connector.http.retryHandler.count=5`, `interval=1000`, `intervalMax=2500` | 3 | 1 s, 2 s |
| `aether.connector.http.retryHandler.count=5`, `interval=1000`, `intervalMax=60000` | 6 | 1 s, 2 s, 3 s, 4 s, 5 s |
| `count=6`, `interval=10000`, through `MAVEN_ARGS` | 7 | 10 s to 60 s — 210 s in total |

Four things, and three of them contradict how the configuration reads:

- **The interval grows by multiplication, not doubling.** `interval × attempt`. The default three
  retries are 5 + 10 + 15, which is the 30.4 s the CI log shows between the one request and the
  build failure — so that log was Maven spending every retry it had, not Maven failing once.
- **`intervalMax` is a ceiling that stops the loop, not a cap on the wait.** At 2500 the resolver
  gave up after two retries, because a third would have waited 3000. Its default is 300000, read out
  of `HttpTransporter`. So between the longest interval a configuration asks for and 300 s the
  property does nothing at all — the 120000 `issue #183` proposed is in that dead band — and below
  that interval it shortens the retry it was reached for to lengthen. There is no value that helps.
- **The documented prefix is for a resolver we do not run.** 1.9.27's string table carries
  `aether.connector.http.retryHandler.{count,interval,intervalMax,name,serviceUnavailable,requestSentEnabled}`
  and a per-repository `…count.<repositoryId>` beside each. `aether.transport.http.` appears only in
  class names. A misspelling and a correctly-spelled 2.x property are the same event: nothing
  happens, nothing is logged.
- **`MAVEN_ARGS` carries resolver properties**, so a stage configures both of its `mvn` lines once.

The 429 the harness provoked prints the same `[ERROR] … status code: 429` summary as the CI failure,
which is what says the harness reproduced it rather than something adjacent.

## 2. What each way of warming the layer costs

A fresh container per row, an empty local repository, `broker/person-identifier`'s pom and `src/`,
the same image, counting `Downloading from` lines.

| sequence | first command | `package` after it | per stage |
| --- | --- | --- | --- |
| `dependency:go-offline`, then `package` | 1085 | 211 | **1296** |
| `dependency:resolve`, then `package` | 830 | 118 | **948** |
| `package` on a pom with no sources, then `package` | 768 | **0** | **768** |
| `package` alone, no warm-up at all | 768 | — | **768** |

`mvn --offline package` succeeds after the no-sources warm-up, on `person-identifier` and
`verified-email` both, and produces the real jar. That is the measurement that matters: the warm-up
is the same lifecycle as the build, so it resolves neither more nor less than the build needs.

The two machines `issue #183` weighed against each other read the same way down that column. CI,
cold every run, pays the whole of it: 768 against 1296. A developer's machine keeps the first layer
and pays only the second: 0 against 211. Nothing here has to be traded for anything else, which is
what made the ticket's 41%-against-3.5× arithmetic moot rather than close.

`dependency:resolve`, the third path nobody had counted, sits between the two: it resolves the
dependencies but not the lifecycle's plugins, so `package` goes to Central 118 times after it.

The 317 artifacts `go-offline` fetched that `package` never asks for are 1085 − 768 from the first
and third rows, which were counted the same way in the same hour.

## Counting, for whoever repeats this

Since the `jboss-public-repository` mirror (`issue #198`) ten of these requests are logged as
`Downloading from central-for-jboss:` rather than `from central:`. Every row above counts
`Downloading from`, so it counts those too; `docs/notes/2026-11-19-what-go-offline-leaves-for-package.md`
predates the mirror and counted `from central`, which is most of the three-to-six artifact
difference between its rows and the first row here.
