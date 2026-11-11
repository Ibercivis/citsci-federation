# Local environments for the Federated Apps

Every Federated App gets an environment that runs on a laptop with a sample of data. **One is
built for each application, as it is integrated** — the pilot is a composition of applications
(ADR-0009), and an application nobody can start is an application nobody can integrate.

**No local environment takes data from production.** The rule that makes that cheap rather than
virtuous is the same in every one of these applications so far:

> The personal data is in the accounts tables, and nowhere else. The domain data carries nothing
> about anybody. So the half of the dataset that should be realistic is exactly the half that can
> be rebuilt from a public source, and the half that would have carried personal data is the half
> that is cheapest to invent. Nothing is copied, so there is nothing to anonymise.

Each environment lives on that application's `federation` branch, in a `LOCAL-DEV.md` at the root
of its repository. This file is the index and holds no instructions of its own.

**An application missing from this list has no local environment**, not an undocumented one.

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

Not done. The application has no Dockerfile and no compose file, so the environment has to be
built rather than reused.

## Building one for a new application

The order that worked twice:

1. **Find the seam.** Which tables hold personal data, and which hold domain data. The answer
   decides everything else, and so far it has always been: accounts, emails, profile — and nothing
   else.
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

Weaknesses found while reading the code go to `docs/private/security-findings.md` in the turn they
are found, and to nothing public.
