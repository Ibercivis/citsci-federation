# The documentation is written in English

Everything this repository keeps as a record is written in **English**: ADRs, the glossary, specs,
the agent docs, learning artifacts, issue and pull request bodies, and commit messages. The
gitignored operational notes under `docs/private/` are held to the same rule, so that a conclusion
can move from them into a public document without being rewritten first.

The reason is accountability. The record has to be readable by everyone who may be asked to answer
for it — project partners, reviewers of the European-funded work, auditors, a developer who joins
in a later phase, and the agents that read these files before changing anything. A record kept half
in Spanish is a record that each of those audiences can only half read, and the half each one misses
is not the same half. English is also already the language of the vocabulary these documents are
about: `issuer`, `sub`, Verified Email, Person Identifier. Writing the prose around those terms in
Spanish adds a translation seam through the middle of every sentence that matters.

This governs **documents, not conversations**. Meetings, calls and correspondence happen in whatever
language the people in them share — a mail to a Spanish supplier is written in Spanish. What the
repository keeps is the English record of them, and where a document records something that was sent
in another language, it says so at the top.

A **comment on GitHub** is a conversation: on an issue, on a pull request, a reply to a review. Its
language is its author's, and this team talks in Spanish. Nothing there is translated into English,
by a person or by an agent.

A **comment in the code** is not one of those, and stays English. It is read with the code it sits
in, by the same people, and a Spanish line in the middle of a file whose identifiers and prose are
English is the translation seam this decision exists to avoid.

The record is what holds. When a comment settles something, the conclusion moves into the body, the
ADR or the spec that owns it, **in English**. That is where the accountability above is owed, and
the only place it was ever owed: nobody is asked to answer for a thread, so a thread only has to be
readable by the people in it.

## Considered Options

- **Spanish, the team's own language.** Rejected. It is the cheapest option for the three people
  writing today and the most expensive one for everybody who has to read the result later. It also
  makes the external audience — the people the accountability is owed to — dependent on a
  translation that nobody is on the hook for producing.
- **Bilingual documents, each decision in both languages.** Rejected. Two copies of a decision are
  two decisions as soon as one of them is edited and the other is not, and the ADRs exist precisely
  to be the one place a decision lives. Nobody would have maintained the second copy, and the first
  phase closes at the end of January.
- **English for published material, Spanish for internal notes.** Rejected, and this is the option
  that was in force by accident until now. It puts a translation step exactly where the work moves
  fastest, between a note taken on a server and the issue that acts on it, which is where
  mistranslations would do real damage.

## Consequences

The comment threads written before this are not wrong in retrospect, and nobody goes back over
them. What was wrong was the wording, which never distinguished a body from the thread on it.

The Veridas consultation (`docs/notes/veridas-technical-questions.md`) was sent in Spanish before
this decision. It is kept as the English translation of what was sent, with a note saying so: the
document is frozen, and an answer arriving in Spanish will be recorded the same way.

The two learning artifacts published before this decision were translated and republished at their
existing URLs, so the links already shared with the team still resolve. Translating them fixed only
the language: the first one's third figure still contradicts ADR-0004, which is what issue #20 is
for, and nothing in a learning artifact decides anything either way.

Nothing here claims the English will be good. A clumsy English sentence that says the right thing is
the expected output and is not worth a round trip to fix.
