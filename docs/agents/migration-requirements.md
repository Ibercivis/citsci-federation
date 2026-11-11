# Migration Requirements

What a Federated App's **existing** accounts would need in order to move onto the Broker, recorded
one file per app in `docs/migration/<app>.md`.

Migration is **outside the pilot's committed scope**. These records exist so that it is cheap if
time allows, and so that its cost is known rather than guessed. **A record is not a commitment.**

## When this applies

While integrating a Federated App you learn things about its existing accounts that the integration
itself does not need. That is the material. Start the app's record the first time you read its
authentication code, and update it whenever an answer changes.

Name the file after the app as `GLOSSARY.md` names it, lowercased: `docs/migration/lostatnight.md`.

## The split that decides what goes where

This repository is public. The requirement is publishable; the measurement is not.

| `docs/migration/<app>.md` — public | `docs/private/` — never published |
|---|---|
| What must happen, in what order, and who does it | Any count measured in a production database |
| A requirement stated as a conclusion | The query, the host, the credentials used |
| Which steps are reversible, and what each costs | Weaknesses found on the way → `security-findings.md` |

> "Some accounts have no local password, so they must be linked before that route closes" is a
> requirement. "7 of 10 accounts have no password" is a measurement of a partner's production
> system. Write the first, keep the second in `docs/private/security-findings.md`, and point at it
> without repeating the number.

## What a record holds

Eight short sections, in this order. If one is empty write "None known" — do not delete it, because
a missing section reads as "nothing to say" when it means "nobody looked".

1. **Identity today** — how the app authenticates now: library and version, the routes, any provider
   relationships it holds **of its own**, and what it uses as an account's identifier.
2. **Populations** — the kinds of existing account, each described by **what it has**: a password, a
   provider account, a verified address. Never by how many. The kinds are what decide the steps.
3. **Requirements** — what must be true before any account moves. One line each, each one testable.
4. **Order** — steps that must happen in sequence, **with the consequence of the wrong order**.
5. **Irreversible steps** — what cannot be undone, and what it costs if done too early.
6. **Who acts** — per step: the Broker operator, the app maintainer, or a human with database
   access. A step with no owner is not a step.
7. **Open questions** — what is not known, and **what measurement would settle it**. Name the
   measurement, not the answer you expect.
8. **Status** — `not started` / `agreed with the maintainer` / `done`, the date, and the commit of
   the app's code the record was written against.

## Three rules that came from getting it wrong

**State the order's consequence, not just the order.** "Link before closing the app's own provider
route" is forgettable. "Closing it first locks out everyone who never set a password" is not, and it
is the same fact.

**Define a population by what it has, not by how it signed up.** An account with a verified address
and no password needs the same treatment whichever button produced it — and the next app will have
the same populations under different names.

**Say what migration does not remove.** An app keeping its own sign-in with no sunset date (ADR-0007)
keeps its password store too. If a record implies the app's exposure drops, say plainly what stays
and which later decision is the one that actually removes it.
