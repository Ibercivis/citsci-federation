<!-- Research note, not a decision. Measured 21 November 2026 on `imresamu/postgis:18-3.6`. -->

# Moving Geonity's database to PostGIS 18 costs its volume

**Verdict.** An 18 image adopts no cluster an older major wrote, and no mount changes that. The shape
18 asks for — one mount above the data — is refused too: it looks for a cluster anywhere below the
mount and finds the 16 at the root. `broker-db` in `compose.yaml` sits at that shape and starts
because its volume began on 18, not because the shape rescues anything.

**Read on only if** you are deciding whether Geonity moves to PostgreSQL 18 (`issue #39`), or you
are about to mount a database volume in this composition.

## What was measured

Three containers, `POSTGRES_DB=citsci`, nothing else varied:

| Mount | Volume | Result |
| --- | --- | --- |
| `…:/var/lib/postgresql/data` | nothing in it | refused |
| `…:/var/lib/postgresql` | cluster written by 16-3.5 | refused |
| `…:/var/lib/postgresql` | nothing in it | starts, accepts connections |

The first row is kept apart from the second deliberately: a mount at `data` is refused **with nothing
in it at all**, reported as an unused mount. `PGDATA` in the image is `/var/lib/postgresql/18/docker`,
so a volume at `data` could never hold the cluster, and the image stops rather than write where the
volume is not. The fourth combination — `data` over a cluster of 16 — is `issue #140`'s own
measurement, and is why that ticket exists.
