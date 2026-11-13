# Local environments for the Brokered Apps

Every Brokered App gets an environment that runs on a laptop with a sample of data. **One is
built for each application, as it is integrated** — the pilot is a composition of applications
(ADR-0009), and an application nobody can start is an application nobody can integrate.

**No local environment takes data from production.** The rule that makes that cheap rather than
virtuous is the same in every one of these applications so far:

> The personal data is in the accounts tables, and almost nowhere else. The domain data carries
> nothing about anybody. So the half of the dataset that should be realistic is exactly the half
> that can be rebuilt from a public source, and the half that would have carried personal data is
> the half that is cheapest to invent. Nothing is copied, so there is nothing to anonymise.

Each environment lives on that application's `federation` branch, in a `LOCAL-DEV.md` at the root
of its repository. This file is the index and holds no instructions of its own.

**An application missing from this list has no local environment**, not an undocumented one.

## What these environments are for, and what not to spend time on

The pilot's claim is **one Person, several applications, no second sign-in** (ADR-0009). What has
to work in a local environment is therefore signing in, and the profile that follows the Person
from one application to the next. Everything else is scenery: it exists so the screens are not
empty while you click through a sign-in.

So, concretely: **a blank map is not a defect and is not worth a minute.** These applications draw
their maps with Mapbox, which needs an access token nobody has locally; every other screen works
without one. Do not hunt for a token, do not take one from a production bundle, and do not swap the
map library. The same goes for anything else that only affects how the domain data is displayed.

Build the environment up to the point where you can sign in as a seeded account and read a profile,
say in `LOCAL-DEV.md` what is blank and why, and stop there.

## LostAtNight

- [`Ibercivis/gdalface`](https://github.com/Ibercivis/gdalface) · `federation` · `LOCAL-DEV.md`

Django with templates, PostgreSQL, Redis, GDAL. Additive: `Dockerfile.local`,
`docker-compose.local.yml`, `settings_local.py`, `local_dev/`, one `seed_local` command.

```sh
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml exec web python manage.py migrate
docker compose -f docker-compose.local.yml exec web python manage.py seed_local
```

Public source: real ISS night frames from NASA's public-domain archive, with their published
coordinates, downloaded at seed time. Everything else invented. Mail is caught by `mailpit`
(<http://localhost:8025/>), because email verification is mandatory and a real address typed into a
local form would otherwise reach a real person. Site on <http://localhost:8000/>.

## Geonity

- [`Ibercivis/citsci-api`](https://github.com/Ibercivis/citsci-api) · `federation` · `LOCAL-DEV.md` — API, data
- [`Ibercivis/Geonity`](https://github.com/Ibercivis/Geonity) · `federation` · `LOCAL-DEV.md` — web app, admin panel

Django REST + PostGIS, Redis, an `rq` worker and a scheduler. The container recipe already
existed; what was added is the dataset. The two front ends are **not** containerised: they are
`npm run dev` on the host.

```sh
docker compose up -d --build
docker compose exec citsci-api python manage.py seed_local
```

Public source: real GBIF occurrence records under CC0 — species, coordinates and dates as
recorded — from a snapshot committed in `local_dev/`, so seeding never touches the network. The
fetch script keeps an **allow-list** of fields so the observer's name is dropped on download, not
on seeding. Accounts, organization and photographs invented. Four projects, six accounts, sixty
observations.

Two things to know before starting the front ends: the API sends **no CORS headers**, so both must
go through their dev server's proxy; and both default to **production** when their `.env` is
missing. Maps need a Mapbox token; everything else works without one. The Flutter client was not
exercised.

## OpenRed

- [`Ibercivis/OpenRed`](https://github.com/Ibercivis/OpenRed) · `federation` · `LOCAL-DEV.md` — API, data
- [`frasanz/openred-react`](https://github.com/frasanz/openred-react) · `federation` · `LOCAL-DEV.md` — web app

Django REST + PostGIS, Redis, **three** `rq` queues and a scheduler. The first one where the
environment had to be **built rather than reused**: there was no Dockerfile and no compose file, so
both are new, along with the database image — see below. The React app is not containerised: it is
`npm ci && npm start` on the host.

```sh
docker compose up -d --build          # first build compiles an extension, a few minutes
docker compose exec api python manage.py seed_local
```

API on <http://localhost:8020/>, app on <http://localhost:3010/>. **The ports are deliberately
unusual**: by the third application, a laptop already has the other stacks on 8000, 8010, 5432, 3000
and 3001.

Public sources, two, because the application has two measurement domains: real gamma readings from
**Safecast** (CC0) and real night-sky brightness from **Globe at Night** (CC BY 4.0), both at the
coordinates in Spain where they were really taken, from a snapshot committed in `local_dev/`. EURDEP
and the CSN's REA network were the institutional alternatives and are not usable: EURDEP is behind a
registration, the CSN publishes a web map rather than a dataset.

Four things this one taught that the first two did not:

- **The allow-list has to drop the record's own id, not just the obvious fields.** A Safecast
  measurement id resolves to a page naming whoever submitted it, so the id is a back-reference to a
  person; the snapshot keeps a one-way `ref` instead. Same reasoning retires `device_id` (one
  instrument, therefore one owner) and Globe at Night's `SQMSerial`.
- **An open dataset publishes impossible values, and the fetch script is where to catch them.**
  Globe at Night's 2025 file has sky-brightness readings brighter than daylight and a row at
  latitude 0.0 filed under Spain; seeded unchecked they produced a "brightest sky" above direct
  sunlight.
- **Dropping the device id costs you the ability to tell two contributors apart**, so routes from
  different people in the same area at the same time merge. Cutting a track wherever the step
  between readings implies a speed no vehicle reaches separates them again without knowing who
  either was.
- **Real timestamps, kept in order, give real geometry for free.** Keeping one reading per ~1 km
  cell preserves the shape of each volunteer's drive, so tracks, their distances and their speeds
  are all real rather than arranged.

Before starting the app, two things: its dev server **defaulted to production** —
`"proxy": "https://api.open-red.es"` in `package.json`, now a configurable `setupProxy.js` that
defaults to the local API and warns on a non-local target — and `npm install` produces a tree that
does not compile, so **use `npm ci`** and leave the committed lockfile alone. Maps need a Mapbox
token; everything else works without one. The Flutter client was not exercised: it talks to the
devices over BLE and needs hardware.

One deviation worth knowing about, recorded in the application's `LOCAL-DEV.md`. The database
image is **not** `postgis/postgis`: OpenRed's raw SQL calls a server-side `h3` function for the H3
aggregations and the PDF reports, h3-pg is not in those images, and it could not be added to the
tags tried: they are Debian bullseye, and `apt.postgresql.org` no longer serves that suite, so
`apt-get update` fails inside them before anything can be installed.

**The map's data is served; only its basemap is blank, for the Mapbox reason above.** Both of the
map's data paths answer with seeded rows: `…/h3-aggregation/`, which it calls below zoom 15, and
`…/compact/`, which it calls at zoom 15 and above — for radiation and for light pollution alike.
OpenRed's own `LOCAL-DEV.md` and openred-react's still give a missing endpoint as the reason the map
is blank; both are corrected on their `local-dev-environment` branches, awaiting review.

## Building one for a new application

The order that worked three times:

1. **Find the seam.** Which tables hold personal data, and which hold domain data. The answer
   decides everything else. It is mostly accounts, emails and profile — but **check rather than
   assume**: OpenRed also keeps every recipient's address in its email-log tables, which a "domain
   only" extract of that database would have carried straight out. Look for the columns that point
   at a user, and for anything the application stores *about* having contacted somebody.
2. **Find the public source for the domain half**, and verify it answers without a key before
   building on it. Download it with a script that writes a **committed snapshot**, so the seed
   command never touches the network, and filter it by **allow-list** with an assertion, so fields
   naming people are dropped on download.
3. **Invent the other half** — accounts on the reserved `.invalid` domain, with verified email rows
   so they can sign in, and whatever tokens the API authenticates with.
4. **Cover the shapes that behave differently**, not just the happy one: an empty published object,
   a draft, an anonymous contribution, each answer or field type a screen renders.
5. **Guard the command**: refuse `DEBUG=False`, refuse a database holding accounts it did not
   create, and make `--reset` undo exactly what it made.
6. **Verify by running**: `down -v`, up from nothing, seed, then open the screens.
7. **Write `LOCAL-DEV.md`** on that application's `federation` branch, recording the defects found
   on the way — they reproduce without the tooling and are not yours to fix — and add three lines
   here.

Everything these seven steps write lands in somebody else's repository, so it is named in that
application's words and not in ours — `docs/agents/external-repos.md`, *Vocabulary*, says what that
rules out and what to call things instead.

Weaknesses found while reading the code go to `docs/private/security-findings.md` in the turn they
are found, and to nothing public.
