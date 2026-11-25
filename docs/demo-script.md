# The demo, as a sequence

What to run in front of people, in order, with the state to read off the Broker's own database at
each step. [`trying-it-by-hand.md`](trying-it-by-hand.md) is the per-feature manual pass; this is
the narrative, and it only covers what somebody watching has to see to believe the claim.

Four acts, and a fifth that needs a reset first. The addresses, the seeded accounts and what does
not work yet are in the walkthrough — read it once before running this.

## Before anybody is in the room

1. **`.env.local`, with the four names in [`.env.example`](../.env.example).** Google and GitHub are
   the only Identity Sources in `demo`, and without their client ids and secrets both buttons send a
   Person to a source that refuses them on its own page. The registration they were created in has
   `${BROKER_ISSUER}/broker/<alias>/endpoint` as the redirect URI; the values are not in this
   repository and never will be.
2. **The GitHub account's primary address has to be the one Google signs in with, and verified at
   GitHub.** Act 2 is the whole point of the demo and it proves nothing otherwise: two addresses are
   two Persons, on purpose (ADR-0004), and there is no merge flow to show. An address GitHub has
   not verified still joins, but only through the mail: act 2 stops on **verify your email** and
   the link is in the catcher.
3. **Start from nothing.**

   ```sh
   pnpm clean-slate
   BROKER_MODE=demo pnpm apps:up
   ```

   Not `pnpm apps:up` on its own afterwards — the mode holds only through a reset, and `.env` says
   why. The first run on a cold machine is slow.
4. **One terminal running `pnpm persons --watch`**, where the room can see it. It is what makes the
   Person visible; every screen a Person sees belongs to one application.
5. **One ordinary browser window for act 1, and a private window for each act after it.** Every
   later act needs the Broker's single sign-on session gone, and signing out of an application does
   not end it.
6. **Say once, out loud, that nothing here can deliver mail to a real address.** Every message lands
   in the catcher at `mail.localhost:8080`, the Broker's included. That is what makes a real address
   safe to type, and somebody will ask.

## The view

```sh
pnpm persons           # once
pnpm persons --watch   # redraws every two seconds, until Ctrl-C
```

Project `--watch` beside the browser and leave it there: a row appears as somebody signs in, and
changes as they answer the mail. It reads the Broker's database, because nothing else can show what
the demo is about — an application is told a Person Identifier and nothing more (ADR-0002), and the
account console shows only the Person looking at it.

One row is one Person. `identities` is which sources that Person can arrive through, `-` meaning
none, so the Broker's own credential is the only way in. `pending` is what the Broker is still
waiting for before that Person may reach an application, and `passwords` is how many credentials it
holds for them.

Run it before anything else: **no rows.** The Broker knows nobody, and the applications are full of
accounts that existed before it.

## Act 1 — one sign-in, two applications

1. http://lostatnight.localhost:8080/accounts/login/ → **Sign in with your Ibercivis account**. The
   application sends you away rather than asking for a password; it has none of yours to ask for.
2. The Broker's own page → **Google** → the consent screen, naming LostAtNight → back in the
   application, signed in.
3. http://lostatnight.localhost:8080/user-profile/ → the identifier under **Ibercivis account**.
   Read the last few characters out; they are what to match in a minute.
4. The view → **one row.** Your address, `affirmed = t`, `identities = google`, no password, nothing
   pending. Google affirms the address itself, so the Broker asked nothing and mailed nothing.
5. http://geonity.localhost:8080/login → **Sign in with your Ibercivis account**. **No password is
   asked** — the Broker already knows who you are. Only the consent screen appears, because a grant
   is remembered per application and this is a different one.
6. http://geonity.localhost:8080/profile → the same string, under **Ibercivis account**.
7. The view → **still one row.** Two applications, two accounts, one Person, and neither
   application holds a credential.

## Act 2 — a second Identity, and the same Person

A fresh private window. This is the act the project exists for, and it is silent: GitHub affirms the
address, so the Person is asked nothing in between.

1. http://lostatnight.localhost:8080/accounts/login/ → **Sign in with your Ibercivis account** →
   **GitHub** → authorise the OAuth app.
2. You are signed in. GitHub marked that address verified, and the Broker takes its word on it
   (ADR-0004).
3. The view → **one row, `identities = github + google`.** Same `person_identifier` as act 1.
4. http://lostatnight.localhost:8080/user-profile/ → the same identifier as step 3 of act 1. Nothing
   in the application changed, and nothing in it had to.
5. Optional, and it is Keycloak's own screen rather than ours:
   http://broker.localhost:8080/realms/citsci/account → one Person with **both** accounts linked, and
   the sessions.

## Act 3 — an account that existed before the Broker

The other half of the claim, and it takes a minute.

1. http://lostatnight.localhost:8080/accounts/login/, in another private window →
   `volunteer1@lostatnight.invalid` / `devpass12345`. Signed in, unchanged, with no Broker involved.
2. The view → **unchanged.** That account is LostAtNight's, it is not a Person, and the Broker never
   hears about it. Migration is out of scope.
3. http://lostatnight.localhost:8080/accounts/signup/ → it offers the Broker's button and creates
   nothing. Registration on a Brokered App is the Broker's job now (ADR-0007).

## Act 4 — a registration nobody answered

Use an invented address: nothing is delivered anywhere, and your own is already a Person.

1. The Broker's sign-in page → **Register** → `elena@ibercivis.test`. The form asks for an address
   and no password.
2. **Do not open the mail.** Close the tab, as somebody who got distracted would.
3. The view → a second row. `affirmed = f`, `identities = -`, `passwords = 0`, and
   `pending = UPDATE_PASSWORD, VERIFY_EMAIL`. There is no credential, because the password is chosen
   through the link in the mail and not on the form.
4. Go back to LostAtNight and try to sign in as that address. The Broker's page turns you away:
   there is no password to get wrong, and no application the Person can reach until the mailbox
   answers. `pnpm test` asserts that, in `tests/local-credential.test.ts`.
5. Open the mail now, follow the link, choose a password, and they are in — holding the identifier
   that row already showed. Nothing was minted twice and nothing was reassigned (ADR-0002).

## Act 5 — the hole we know about, optional

This one needs a Broker that has never seen your address, so it costs a reset:

```sh
BROKER_MODE=demo pnpm apps:reset
```

It throws every Person away and comes back up. Run it before the room fills, or skip the act.

1. The view → no rows.
2. The Broker's sign-in page → **Register** → **your own address**, the one Google signs in with. Do
   not open the mail. This is somebody else registering at your address.
3. The view → one Person at your address, no identity, no password, two actions pending. A squatter
   made it.
4. Now sign in with Google from LostAtNight, as in act 1. You are neither refused nor signed in
   silently: you land on **verify your email**, and the link is in the catcher.
5. The view → **still one Person** — now carrying `google`. Your Google arrival was absorbed into
   the Person the registration created.
6. Follow the link and you are in.

What this is: `issue #148`, open, and ADR-0004 names it rather than hiding it. What the squatter gets
is not access — that Person holds no credential and no way to set one without the mailbox. What they
get is your Person made for them, and one extra confirmation in your way. Say it that way round.

## Do not improvise these

- **Single sign-out.** Not settled yet. Say so and move on.
- **OpenRed's own Google button**, on `openred.localhost:8080`. It cannot work, and
  [`trying-it-by-hand.md`](trying-it-by-hand.md) says why. Its **Ibercivis account** button is the
  one to use (`issue #30`).
- **Maps.** Blank, for want of a token nobody has locally, and settled:
  [`local-development.md`](local-development.md).

## What you will be asked

- **"Must I use Google?"** No: **Register** at the Broker is an address and a password it holds
  itself (ADR-0005). Act 4 is that path.
- **"My GitHub address is a different one."** Then you are two Persons, and there is no merge
  flow yet. ADR-0004 took that deliberately, and a future merge has to add an alias rather than
  reassign, because an identifier is never reassigned (ADR-0002).
- **"So whoever reads my mail becomes me?"** Yes, and it is written down as accepted rather than
  overlooked (ADR-0004). The same mailbox already recovers the password.
- **"What do the applications learn about me?"** The identifier, and whatever you tell them
  yourself. No name, no roles: the Broker issues neither (ADR-0003).
- **"Where can I try it?"** Nowhere yet. The composition runs on a laptop, and a public address is a
  later decision we left cheap to take (ADR-0001).
