# Trying the Brokered Composition by hand

What somebody with a browser does to see the pilot work: the manual pass before a pull request, and
the walkthrough to run in front of people. What the composition *is* and how it is wired is in the
[README](../README.md) and ADR-0009 — this file is only the clicking.

**Keep it in step.** A step here that no longer matches what the screen does is worse than no step.
The section that moves is the last one: what does not work yet.

## Before you start

Docker, `git`, `curl`. No token, no `/etc/hosts` line, no credential to obtain: everything the
composition needs is declared in [`.env`](../.env). Node and pnpm are for the shortcuts below and
the test suite; both scripts are POSIX shell and run without them.

Nineteen containers. Docker with less than 8 GB will thrash.

## From nothing

```sh
pnpm clean-slate     # every stack down, and this repository's data with them
pnpm apps:up         # checkout → build → wait → migrate → seed → read every address back
```

`clean-slate` also stops the per-application stacks of
[`local-development.md`](local-development.md), keeping their data. Those are what gets mistaken
for the composition: they publish ports on `localhost`, the composition publishes none, and
`localhost:8000` answering while `lostatnight.localhost:8080` does not is a confusing half-hour.

The first `apps:up` on a cold machine is slow — OpenRed's database compiles an extension, Geonity's
two front ends install their dependencies. Every `apps:up` after a `clean-slate` pays the second of
those again: those `node_modules` live in volumes. It ends by reading every address back through the proxy
and exits non-zero if any answered 000, 400, 502 or 503, so "it came up" is not something to read
by eye.

For a checkout from nothing as well, `rm -rf apps/` first: the four repositories are cloned again.

## The addresses

| | |
|---|---|
| `broker.localhost:8080` | the Broker |
| `lostatnight.localhost:8080` | LostAtNight |
| `geonity.localhost:8080` | Geonity's web app |
| `geonity-admin.localhost:8080` | Geonity's admin panel |
| `geonity-api.localhost:8080` | Geonity's API |
| `openred-api.localhost:8080` | OpenRed's API |
| `mail.localhost:8080` | every message any of them sends |

Everything is reached **by hostname**. `.localhost` resolves to the loopback in every browser with
nothing configured.

## The walkthrough

### 1. A hostname is the only way in

```sh
curl -i http://localhost:8080/
```

404, and `Not a hostname this composition serves.` A request that succeeded as `localhost:8080`
would succeed with cookies and a `redirect_uri` of a shape production never sees, which is the
class of failure this composition exists to meet early (ADR-0001).

### 2. A sign-in at the Broker, asked for the way an application asks

```sh
open "$(pnpm -s sign-in-url)"          # or `geonity`, or `openred`
```

In order:

1. **Sign in to Ibercivis Citizen Science** — the Broker's own page, nobody else's. `demo` / `demo`.
2. The **consent screen**, naming the application. That name comes from the client the realm
   registered for it.
3. Back to `…/accounts/oidc/callback?code=…`, **which 404s**. No application serves that path yet.

The `code=` in the address bar is the Broker having done all of its half. Redeeming it needs the
client secret, which is not a thing to put in an address bar; `pnpm test` redeems codes, over the
protocol, with no browser involved.

### 3. A Person arriving from an Identity Source

The same URL, but instead of typing a password choose **Mock source**: `mock-verified` / `mock`.

That source is a server this repository runs ([`mock-source/`](../mock-source/)) so that the tests
can decide what a source says about an address. It is not a launch source, and it starts only when
`BROKER_MODE=testing`.

### 4. The Person, as the Broker holds them

http://broker.localhost:8080/realms/citsci/account, as whoever step 2 or 3 left you signed in as.

The only screen in the composition that shows the **Person** rather than one application's account:
the profile, the sessions, and — for a Person who arrived from an Identity Source — the source they
are linked to. Step 3's `mock-verified` is linked to `mock`; `demo` is not linked to anything,
because `demo` signs in with a local credential.

It is Keycloak's own screen, not ours. Nothing in the pilot links to it and nothing depends on it,
but it is the shortest answer to "so what does the Broker actually know about me".

### 5. An account that existed before the pilot

Every seeded account is invented, on a `.invalid` address that can never receive mail, and its
password is whatever the seed command printed — `devpass12345` unless somebody passed `--password`.

| Where | Sign in with |
|---|---|
| http://lostatnight.localhost:8080/accounts/login/ | `admin@lostatnight.invalid`, or `researcher@`, or `volunteer1@` |
| http://geonity.localhost:8080/login | `ada@geonity.invalid`, or `rosa@`, or `admin@` |
| http://geonity-admin.localhost:8080/ | `admin@geonity.invalid` |
| http://geonity-api.localhost:8080/admin/login/ | `admin` — Django's admin takes the **username** |
| http://openred-api.localhost:8080/admin/login/ | `admin` |

Everything but Django's own admin signs in by **email address**: all three applications set
`ACCOUNT_AUTHENTICATION_METHOD = 'email'`.

This is the half of the pilot's claim that is not about the Broker at all: an account that existed
before it still signs in, unchanged.

### 6. A sign-up nobody can finish without the mail

Register at http://lostatnight.localhost:8080/accounts/signup/ with any invented address. It lands
on `/accounts/confirm-email/` and goes no further: every application in the composition keeps email
verification mandatory, as production does.

The message is at http://mail.localhost:8080. The link in it carries `lostatnight.localhost:8080` —
the hostname the proxy serves, because django-allauth builds the link from the request rather than
from the `Site` row, which still says `localhost:8000`.

Nothing in the composition can deliver to a real address.

### 7. The three applications, as the Broker knows them

http://broker.localhost:8080/admin/, `admin` / `admin`, realm `citsci` → Clients: **lostatnight**,
**geonity** and **openred**, each with its redirect URI under `/accounts/oidc/*`.

## What does not work yet, on purpose

- **No application has a sign-in button.** The integrations are `issue #30`, `#31` and `#94`, and
  none has landed. So single sign-on *between* two applications is not clickable yet: step 2 is the
  Broker's half, step 5 is each application's own, and nothing joins them. Say this before anybody
  asks.
- **And a button alone will not be enough.** The realm applies `secure-session` to every client, so
  the Broker refuses an authorization request carrying no nonce — and no django-allauth release
  sends one. Step 2 works because `pnpm sign-in-url` sends a nonce itself. Until `PR #105` narrows
  that rule to public clients, the first application to ship its button is still refused, with
  `Missing parameter: nonce`. The day an integration merges, this section wants both numbers.
- **Maps are blank.** They need a Mapbox token nobody has locally, and that is settled:
  [`local-development.md`](local-development.md) says not to spend a minute on it.
- **`openred.localhost:8080` is declared and not served.** It is where OpenRed's React front end
  will answer (`issue #96`); until then the proxy says it serves no such name.
- **`pnpm test` wants the Broker alone**, not the composition — one port 8080 between them:
  `pnpm apps:down && pnpm broker:up && pnpm test`.

## While you are in there

```sh
pnpm apps:logs <service>   # without one, all of them
pnpm apps:down             # stops, keeps the data
pnpm apps:reset            # throws the data away and comes back up
```

A 502 at an address means that application is not up, and its logs say why. Port 8080 already bound
means the Broker-only stack is still running: `docker compose down`.
