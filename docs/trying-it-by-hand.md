# Trying the Brokered Composition by hand

What somebody with a browser does to see the composition work: the manual pass before a pull request,
feature by feature. What the composition *is* and how it is wired is in the
[README](../README.md) and ADR-0009 — this file is only the clicking.
[`demo-script.md`](demo-script.md) is the ordered sequence to run in front of people, and it assumes
this file has been read once.

## Before you start

Docker, `git`, `curl`. No token, no `/etc/hosts` line, no credential to obtain: everything the
composition needs is declared in [`.env`](../.env). Step 9 is the exception, and it is optional. Node and pnpm are for the shortcuts below and
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

The first `apps:up` on a cold machine is slow — OpenRed's database compiles an extension, and the
three front ends install their dependencies. Every `apps:up` after a `clean-slate` pays the second of
those again: those `node_modules` live in volumes. It ends by reading every address back through the proxy
and exits non-zero if any answered 000, 400, 502 or 503, so "it came up" is not something to read
by eye.

For a checkout from nothing as well, `rm -rf apps/` first: the five repositories are cloned again.

## In front of people

```sh
pnpm clean-slate
BROKER_MODE=demo pnpm apps:up
```

`demo` is the realm a deployment imports, with the mail catcher beside it: no `demo` Identity, no
Mock Identity Source, and Google and GitHub as the only Identity Sources. Fill in `.env.local` as in
step 9 first, or both buttons refuse you at the source. A Person then arrives through Google or
GitHub, or registers at the Broker (step 2's **Register**). Wherever a step below says `demo` /
`demo-password`, use one of those, and skip step 3.

The mode holds only through a reset, for the reason `.env` gives. Back to `testing` is `pnpm
apps:reset` without the variable. `pnpm apps:up` refuses `production`, which runs no mail catcher
for the applications to send to.

## The addresses

| | |
|---|---|
| `broker.localhost:8080` | the Broker |
| `lostatnight.localhost:8080` | LostAtNight |
| `geonity.localhost:8080` | Geonity's web app |
| `geonity-admin.localhost:8080` | Geonity's admin panel |
| `geonity-api.localhost:8080` | Geonity's API |
| `openred.localhost:8080` | OpenRed's React front end |
| `openred-api.localhost:8080` | OpenRed's API |
| `mail.localhost:8080` | every message any of them sends, the Broker's included |

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

1. **Sign in to Ibercivis Citizen Science** — the Broker's own page, nobody else's. `demo` /
   `demo-password`.
2. The **consent screen**, naming the application. That name comes from the client the realm
   registered for it.
3. Back to the application's callback with `code=…` in the address bar. For `lostatnight` that is
   `…/accounts/oidc/callback`, **which 404s**: that address is this script's own, LostAtNight serves
   its callback at `/accounts/oidc/ibercivis/login/callback/` and redeems the code itself, which is
   step 5, and nothing serves the bare one. For `geonity` and `openred` it is the web app's
   `/auth/ibercivis/callback`, which says the sign-in did not work — because this URL was not
   started there, so the browser kept no verifier for it.

The `code=` in the address bar is the Broker having done all of its half. Redeeming it needs the
client secret, which is not a thing to put in an address bar; `pnpm test` redeems codes, over the
protocol, with no browser involved.

That page also offers **Register**, which is the Local Credential the Broker holds itself (ADR-0005,
`issue #26`): the form asks for an address alone, the confirmation lands in the same inbox as step 7,
and the link in it is where the password is chosen. `demo` is one of those too, declared in the realm
instead of registered.

### 3. A Person arriving from an Identity Source

The same URL, but instead of typing a password choose **Mock Identity Source**: `mock-verified` /
`mock`.

That source is a server this repository runs ([`mock-identity-source/`](../mock-identity-source/))
so that the tests can decide what a source says about an address. It is not a launch source, and it
starts only in `testing`: in `demo` the sign-in page has no **Mock Identity Source**.

### 4. The Person, as the Broker holds them

http://broker.localhost:8080/realms/citsci/account, as whoever step 2 or 3 left you signed in as.

The only screen in the composition that shows the **Person** rather than one application's account:
the profile, the sessions, and — for a Person who arrived from an Identity Source — the source they
are linked to. Step 3's `mock-verified` is linked to `mock-identity-source`; `demo` is not linked to
anything, because `demo` signs in with a local credential.

It is Keycloak's own screen, not ours. Nothing of ours links to it and nothing depends on it,
but it is the shortest answer to "so what does the Broker actually know about me".

### 5. Signing in to an application with an Ibercivis account

http://lostatnight.localhost:8080/accounts/login/ → **Sign in with your Ibercivis account**.

The first half of the project's claim, clickable: the application sends you to the Broker, the Broker
signs you in, the application redeems the code itself and you come back signed in. `demo` /
`demo-password` as in step 2, and the Broker asks for consent on the way, because the client is
declared `consentRequired`.

Then http://lostatnight.localhost:8080/user-profile/: the personal area names the **Ibercivis
account** and shows the identifier the Broker minted — the same string every application in the
composition is told (ADR-0002), and the only thing LostAtNight stores about that account.

`/accounts/signup/` is closed there: it offers the same button and creates nothing. Registration on
a Brokered App is the Broker's job now (ADR-0007), and LostAtNight is the first application where
that has landed.

Geonity does the same from http://geonity.localhost:8080/login (`issue #31`). There the web app
sends you to the Broker and comes back to `/auth/ibercivis/callback`, and the API redeems the code.
The profile page shows the identifier under **Ibercivis account**. `/register` leads to `/login`,
and the paragraph beside the button says that an address already used by a Geonity account is
refused. Its API's registration endpoint stays open, because the mobile app still creates accounts
there.

OpenRed, from http://openred.localhost:8080/login (`issue #30`), is Geonity's shape again: the same
callback page, the same refusal of an address it already holds, the same registration endpoint left
open for a mobile client. **My Profile** names the identifier, `/register` leads to `/login`, and
the navbar, the landing page and the confirmation screens no longer offer a sign-up either. Two
things there are its own — its API checks the ID token's signature itself, because the allauth it
pins would otherwise read the identity from an unsigned `userinfo` response, and the account it
creates is named `user`, because the service sends no first name and that application's username
generator reads nothing else.

**The registration closure is `agualis`'s to walk, in all three**, and it is a name rather than a
test on purpose: the Broker cannot see whether an application still has a sign-up form, and no test
in this repository runs the JavaScript that would render one. `issue #34` is what turns it into an
assertion; until then it is this walk.

### 6. An account that existed before the Broker

Every seeded account is invented, on a `.invalid` address that can never receive mail, and its
password is whatever the seed command printed — `devpass12345` unless somebody passed `--password`.

| Where | Sign in with |
|---|---|
| http://lostatnight.localhost:8080/accounts/login/ | `admin@lostatnight.invalid`, or `researcher@`, or `volunteer1@` |
| http://geonity.localhost:8080/login | `ada@geonity.invalid`, or `rosa@`, or `admin@` |
| http://geonity-admin.localhost:8080/ | `admin@geonity.invalid` |
| http://geonity-api.localhost:8080/admin/login/ | `admin` — Django's admin takes the **username** |
| http://openred.localhost:8080/login | `rosa@openred.invalid`, or `admin@`, or a volunteer |
| http://openred-api.localhost:8080/admin/login/ | `admin` |

Everything but Django's own admin signs in by **email address**: all three applications set
`ACCOUNT_AUTHENTICATION_METHOD = 'email'`.

This is the half of the project's claim that is not about the Broker at all: an account that existed
before it still signs in, unchanged.

### 7. Mail nobody outside this machine can receive

Ask for a password reset at http://lostatnight.localhost:8080/accounts/password/reset/ for
`volunteer1@lostatnight.invalid`, one of the seeded accounts.

The message is at http://mail.localhost:8080. The link in it carries `lostatnight.localhost:8080` —
the hostname the proxy serves, because django-allauth builds the link from the request rather than
from the `Site` row, which still says `localhost:8000`.

A sign-up used to be the way to show this, and LostAtNight no longer has one. The applications whose
registration is still open keep email verification mandatory as production does, so signing up there
goes no further than `/accounts/confirm-email/` until the message is read.

Nothing in the composition can deliver to a real address.

### 8. The three applications, as the Broker knows them

http://broker.localhost:8080/admin/, `admin` / `admin`, realm `citsci` → Clients: **lostatnight**,
**geonity** and **openred**. LostAtNight's redirect URI is under `/accounts/oidc/*`, because its
own library serves that path. Geonity's and OpenRed's are the one page of each web app that receives
a code, `/auth/ibercivis/callback`.

### 9. Google and GitHub, with real credentials

The one step that needs something `.env` cannot hold. Copy [`.env.example`](../.env.example) to
`.env.local`, uncomment and fill in the client ids and secrets the two applications were
registered with, and `pnpm broker:reset`. A line left empty breaks that button; leave it commented. Without them, both buttons send you to Google or GitHub with
`client_id=not-configured`, and the source refuses you there.

- **Google**: choose **Google** on the Broker's sign-in page and sign in with a real account. You
  come back with a Person Identifier, as in step 2, and step 4 shows the Person with a Google
  Identity and a confirmed address.
- **GitHub, at an address nobody holds**: choose **GitHub** with an account whose primary address
  no Person has. If GitHub verified it, you come back with a Person Identifier. If not, the Broker
  asks for an address and sends the link to the mail catcher (step 7), and you are signed in only
  after following it.
- **GitHub, at the address Google used**: with that address verified at GitHub, you come back as
  the Person Google made, asked nothing in between. Unverified, the Broker holds you on "verify your
  email" and mails the address that Person already holds; following the link joins the two
  Identities, and nothing is written until it is followed (`issue #149`).
- **What the imitation stands in for**: these two bullets are what `tests/github-source.test.ts`
  holds against an imitation of GitHub. Walking them with a real account is how to tell whether
  GitHub still answers `/user/emails` the way the imitation does.

**TODO — where this step goes in `testing` is not settled.** `pnpm broker:reset` takes the Broker's database and
the mail catcher with it, so the step throws away the Persons, the Identities and the mail that
steps 2 to 7 just built, and then refers back to all three. The applications stay up from
`compose.apps.yaml`, holding accounts that name Person Identifiers nobody has any more. In `demo`
the question does not arise: the credentials are in `.env.local` before the first `apps:up`, so no
reset follows. In `testing`, `pnpm apps:reset` leaves the whole composition coherent with the new
Broker, and is the one-line fix. `PR #164` weighed the three.

## What does not work yet, on purpose

- **No test asserts single sign-on across two applications.** All three have a button now
  (step 5), so it can be tried by hand — sign in at one, then open another and press its button,
  and the Broker should not ask again. The browser test that asserts it is `issue #34`.
- **Maps are blank.** They need a Mapbox token nobody has locally, and that is settled:
  [`local-development.md`](local-development.md) says not to spend a minute on it.
- **"Sign in with Google" fails on OpenRed's front end**, and could not do otherwise: it would
  need an OAuth client with this composition's address registered as an authorised origin, which
  nobody has. The composition hands it a correctly shaped placeholder instead, because an empty one
  throws from Google's own script as `/login` mounts and takes email sign-in down with it. Sign in
  with an address and a password.

## While you are in there

```sh
pnpm apps:logs <service>   # without one, all of them
pnpm apps:down             # stops, keeps the data
pnpm apps:reset            # throws the data away and comes back up
```

A 502 at an address means that application is not up, and its logs say why. Port 8080 already bound
means the Broker-only stack is still running: `docker compose down`.
