<!-- Research note, November 2026. Every claim below is sourced; the "Unverified" section at the
end lists what we could not confirm from a primary source. Our own hosts are described generically
on purpose: this repo is public. -->

# Making it impossible for an LLM agent to write to a production database

> **Deferred, 2026-11-11.** None of this is being built yet. For now a single light rule in
> `AGENTS.md` asks agents not to modify a production database without explicit, case-by-case
> confirmation from the user — and that rule is, by this note's own section 3, a guardrail inside the
> agent's reach, not a boundary. The decision was made with that understood: the team is small,
> backups exist, and the time is better spent on the pilot. This note is the plan for when that
> changes; start at Phase 1 in section 8, which is the cheap half and the half the question actually
> asks for. One limit of the reasoning, recorded so it is not rediscovered later: backups answer a
> mistaken write, not data read or disclosed, and one of the two hosts keeps its database backups
> only on the machine itself.

## The situation, generically

A small team works with LLM coding agents that can run shell commands on developer workstations and,
over SSH, on production hosts. Those hosts run a number of Django/React applications, each with a
local PostgreSQL database holding real participant data. We want reads for diagnosis and we want
writes to be **impossible**, not discouraged: no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`,
`DROP`, no migrations, no `psql` write, no write from a Django shell.

## The one-paragraph answer

Nothing inside the agent's own tooling can give us this. Claude Code's documentation says so in as
many words about the mechanism people reach for first: a Bash deny rule "covers the invocation Claude
usually produces and **isn't a security boundary** around the program"
([Permissions](https://code.claude.com/docs/en/permissions)). The boundary has to be something the
agent's process cannot reach: a **Unix account** that has no `sudo` and cannot read the application's
database credentials, holding credentials for a **PostgreSQL role with no write privileges**. The
strongest version — and, for diagnosis, the cleanest — is to point the agent at a **hot standby**,
where the refusal comes from the server's recovery state rather than from a grant table. Everything
else on the list is either a convenience guardrail or a defence-in-depth layer on top of those two.

## The layer model: who controls what

The useful question about any mechanism is not "does it stop a write?" but "who would have to
cooperate for it to stop stopping?" That gives three layers.

| Layer | Mechanism lives in | Can the agent's own actions route around it? |
| :-- | :-- | :-- |
| **Agent layer** | `CLAUDE.md`, prompts, `permissions.deny`, `PreToolUse` hooks, Claude Code's sandbox, an MCP server's "read-only mode" | Yes, in general. It is text matching, model judgement, or a process the agent's own shell commands sit inside. |
| **Host layer** | Unix user and group membership, `sudo`, file modes on credential files, `pg_hba.conf`, SSH configuration | No. Enforced by the kernel and by `sshd`/`postgres` before the agent's code runs. |
| **Server-state layer** | PostgreSQL privileges; a server in recovery (`hot_standby`); a separate host holding a restored copy | No. Enforced by PostgreSQL, or by the data simply not being there. |

A mechanism is worth something exactly to the degree it sits below the agent layer. The ranking at
the end of this note is that one idea applied to each item.

---

## 1. PostgreSQL-side enforcement

### 1.1 What is a real boundary: privileges

A role with no `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` privilege on a table cannot write it, full stop.
This is checked by the server on every statement and there is no session setting that turns it off.

The convenient way to express "read everything, write nothing" is the predefined role
`pg_read_all_data` (PostgreSQL 14 and later). The manual defines it as granting the ability to

> Read all data (tables, views, sequences), as if having `SELECT` rights on those objects, and USAGE
> rights on all schemas, even without having it explicitly.
>
> — [Predefined Roles](https://www.postgresql.org/docs/17/predefined-roles.html)

The phrase **"even without having it explicitly"** is the part that matters operationally: because
the privilege is not recorded per object, it covers tables created *later*. A hand-rolled
`GRANT SELECT ON ALL TABLES IN SCHEMA public` does not — it enumerates what exists at the time — and
that is what `ALTER DEFAULT PRIVILEGES` is for. So on PostgreSQL 14+, **`pg_read_all_data` removes
the need for `ALTER DEFAULT PRIVILEGES` for this purpose**, which is worth knowing because the
default-privileges route has a trap: the manual states that

> at object creation time, new object permissions are only affected by the default privileges of the
> current role, and are not inherited from any roles in which the current role is a member.
>
> — [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)

That is, defaults are keyed to *the role that runs `CREATE TABLE`*. With Django, that is whichever
role ran `migrate`. If that ever changes — a different deploy user, a one-off fix applied by hand —
new tables silently stop carrying the grant, and the read-only role silently loses visibility. The
failure is in the safe direction (the agent sees less), but it is a maintenance cost that
`pg_read_all_data` does not have.

Two caveats on `pg_read_all_data` from the same page:

- It does **not** carry `BYPASSRLS`. If any application uses row-level security, the read-only role
  sees only what the policies allow. For diagnosis that may be a limitation rather than a problem.
- It is a *read* role only. Its sibling `pg_write_all_data` is the thing never to grant, and the page
  warns separately that `pg_read_server_files`, `pg_write_server_files` and
  `pg_execute_server_program` "bypass database-level permission checks and could be used to gain
  superuser-level access."

### 1.2 What is **not** a boundary: `default_transaction_read_only`

This is the single most important negative finding in this note, because the setting looks like a
switch and is in fact a default.

`ALTER ROLE agent SET default_transaction_read_only = on` makes every new transaction in that role's
sessions read-only. The manual's description of the parameter is explicitly about defaults:

> A read-only SQL transaction cannot alter non-temporary tables. **This parameter controls the default
> read-only status of each new transaction.** The default is `off` (read/write).
>
> — [Client Connection Defaults](https://www.postgresql.org/docs/17/runtime-config-client.html)

And the session can turn it off again. `SET TRANSACTION` documents that the session default

> can be overridden by `SET TRANSACTION` for an individual transaction
>
> — [SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html)

so all of `BEGIN READ WRITE`, `START TRANSACTION READ WRITE`, `SET TRANSACTION READ WRITE`,
`SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE` and `SET default_transaction_read_only = off`
are available to the session.

We wanted this settled definitively rather than by inference, so we read the server source. In
`guc_tables.c` the parameter is declared with context class `PGC_USERSET`:

```c
{"default_transaction_read_only", PGC_USERSET, CLIENT_CONN_STATEMENT,
    gettext_noop("Sets the default read-only status of new transactions."),
```

— [`src/backend/utils/misc/guc_tables.c`, REL_17_STABLE](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/misc/guc_tables.c)

`PGC_USERSET` surfaces in `pg_settings.context` as `user`, which the manual defines as:

> These settings can be set from `postgresql.conf`, or within a session via the `SET` command. **Any
> user is allowed to change their session-local value.**
>
> — [`pg_settings`](https://www.postgresql.org/docs/17/view-pg-settings.html)

There is no privilege to revoke here either. PostgreSQL 15 added `GRANT ... ON PARAMETER`, but the
privileges chapter says of the `SET` privilege:

> (While this privilege can be granted on any parameter, it is **meaningless except for parameters
> that would normally require superuser privilege to set**.)
>
> — [Privileges](https://www.postgresql.org/docs/17/ddl-priv.html)

`default_transaction_read_only` is not such a parameter, so there is nothing to withhold.

**Conclusion: `default_transaction_read_only` belongs in the configuration as a courtesy — it makes
an accidental write fail with a clear message instead of succeeding — and must never be counted as
the mechanism that prevents writes.** It is a seatbelt reminder chime, not a locked door. Setting it
with `ALTER ROLE` is still worth doing precisely because the role it is set on *also* has no write
privileges; the two together give a fast, legible failure and a hard stop behind it.

Note also, from `SET TRANSACTION`, that even a genuinely read-only transaction is "a high-level
notion of read-only that does not prevent all writes to disk", and that `COPY FROM` into a
*temporary* table is permitted. Neither touches application tables, but it means "read-only
transaction" and "the server wrote nothing" are not the same statement.

### 1.3 `REVOKE` from `PUBLIC`

PostgreSQL grants some privileges to `PUBLIC` by default. The privileges chapter lists them:

> No privileges are granted to `PUBLIC` by default on tables, table columns, sequences, foreign data
> wrappers, foreign servers, large objects, schemas, tablespaces, or configuration parameters. For
> other types: `CONNECT` and `TEMPORARY` (create temporary tables) privileges for databases;
> `EXECUTE` privilege for functions and procedures; and `USAGE` privilege for languages and data
> types (including domains).
>
> — [Privileges](https://www.postgresql.org/docs/17/ddl-priv.html)

For our purpose: **tables are not the problem — functions are.** `EXECUTE` on functions and
procedures goes to `PUBLIC` by default, so if any database contains a `SECURITY DEFINER` function
owned by a privileged role that performs a write, the read-only role can call it and the write
succeeds with the owner's privileges. Vanilla Django does not create such functions, but extensions
and hand-written triggers/helpers can. This is a thing to check per database, not to assume.

`CONNECT` to `PUBLIC` also means the read-only role can connect to *every* database in the cluster,
not only the one we intended, which is worth tightening if the clusters are shared.

### 1.4 `pg_hba.conf`

`pg_hba.conf` decides *who may authenticate as which role, over which transport, with what proof*. It
is a host-layer file (root owns it; the agent account must not be able to write it) and it is where
the `sudo` hole in section 2 actually lives.

Two mechanics matter. First, there is no fall-through:

> The first record with a matching connection type, client address, requested database, and user name
> is used to perform authentication. There is no "fall-through" or "backup": if one record is chosen
> and the authentication fails, subsequent records are not considered. If no record matches, access is
> denied.
>
> — [The pg_hba.conf File](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html)

So a restrictive record added *below* a permissive catch-all does nothing. Order is the
configuration.

Second, the two methods to understand:

> **peer:** Obtain the client's operating system user name from the operating system and check if it
> matches the requested database user name. This is only available for local connections.
>
> **trust:** Allow the connection unconditionally. This method allows anyone that can connect to the
> PostgreSQL database server to login as any PostgreSQL user they wish, without the need for a
> password or any other authentication.
>
> — [Authentication Methods](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html)

`peer` is the one that turns an OS identity into a database identity. A line like
`local all all peer` means: become the `postgres` OS user by any means and you are a database
superuser with no password. `trust` is worse and should not appear at all.

The positive configuration we want is a record for the read-only role that demands a password, placed
*above* anything broader, and the absence of any `peer`/`trust` record that the agent's OS account
can match. `scram-sha-256` rather than `md5`: the manual notes that `md5` means "Perform
SCRAM-SHA-256 **or** MD5 authentication", so `md5` is a weaker superset, not a different thing.

### 1.5 Event triggers: no help here

Event triggers do not cover DML. The manual is direct about the division of labour:

> Unlike regular triggers, which are attached to a single table and capture only DML events, event
> triggers are global to a particular database and are capable of capturing DDL events.
>
> — [Event Triggers](https://www.postgresql.org/docs/17/event-triggers.html)

We checked the firing matrix: `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` do not appear in it
([Event Trigger Firing Matrix](https://www.postgresql.org/docs/17/event-trigger-matrix.html)). So an
event trigger could in principle abort all DDL — the manual's own example is a function that raises
`'command % is disabled'` on `ddl_command_start` — but it cannot touch a single `UPDATE`.

And it is the wrong layer anyway, for two reasons. `CREATE EVENT TRIGGER` says

> Only superusers can create event triggers.
>
> — [CREATE EVENT TRIGGER](https://www.postgresql.org/docs/17/sql-createeventtrigger.html)

so anyone who could install one could also remove it; and a blanket DDL abort breaks the
application's own deploys. **Verdict: not part of the arrangement.** A `ddl_command_start` trigger
that merely *logs* who ran DDL is a reasonable audit addition, but it is detection, not prevention.

---

## 2. The `sudo` hole, and why the OS account is the real boundary

This is the finding that reorders the whole list.

Every privilege model in section 1 is a statement about **database** roles. `sudo -u postgres psql`
does not authenticate as a database role at all in the usual configuration: it changes the OS
identity first, and `peer` then hands over the matching database identity — the superuser — with no
password to produce. Nothing in the grant tables is consulted in a way that could refuse it.

So the chain is: *membership of the `sudo` group* → *any OS identity on the host* → *the `postgres` OS
user* → *`peer`* → *database superuser* → *every table in every database on that cluster*. The
database layer is not defeated; it is **never reached**. An agent whose OS account is in `sudo` has
write access to all ten databases regardless of what we do with `GRANT` and `REVOKE`, and the fix is
not a better grant.

Claude Code's own documentation frames the blast radius the same way, in a sentence about its working
directory boundary:

> The boundary is a permission prompt, so a Bash command you approve can still write anywhere **your
> user account can**.
>
> — [Security](https://code.claude.com/docs/en/security)

That is the correct unit of analysis: **the agent can do what its Unix account can do.** Shrink the
account.

### 2.1 The minimal correct arrangement on the host

1. **A dedicated OS account for agent work.** Not a developer's account, not the account the
   application runs as, not the deploy account.
2. **Not in `sudo`, `wheel`, `adm`, or any group that confers administrative control.** No entry in
   `sudoers` and no drop-in under `sudoers.d`. Verify positively: as that account,
   `sudo -n true` must fail, and `id` must show nothing but the account's own group.
3. **No readable path to the application's credentials.** This is the step most likely to be missed.
   Each Django app's settings or environment file contains the password for a role that *can* write.
   If the agent account can read that file, the read-only role is decorative — the agent simply
   connects as the application. So: those files owned by the application user, mode `0640` or
   tighter, group restricted to the application's own group, and the agent account not in it. The
   same applies to any `~/.pgpass`, backup scripts, CI checkouts, container environment files, and
   systemd unit files carrying `Environment=`.
4. **No write access to the deployed application code.** An agent that can edit a view, a management
   command or a signal handler can make *the application* perform the write on the next request. The
   agent account should not own the code directory. Changes reach production through the existing
   deploy path, not through the agent's shell.
5. **Credentials only for the read-only role**, in that account's own `~/.pgpass` at mode `0600`, so
   no password ever appears in a command line the agent composes.
6. **The agent's SSH key only in that account's `authorized_keys`.** If the key is also in a
   developer's or the deploy account's file, steps 2–4 are bypassed by choosing where to log in.

Optionally, `sshd` can narrow it further. `ForceCommand`

> Forces the execution of the command specified by `ForceCommand`, ignoring any command supplied by
> the client. [...] The command originally supplied by the client is available in the
> `SSH_ORIGINAL_COMMAND` environment variable.
>
> — [sshd_config(5)](https://man.openbsd.org/sshd_config.5)

inside a `Match User` block could pin the agent's sessions to a wrapper. We would not lean on it: the
same page notes `ForceCommand` "does not limit other access, such as TCP, agent, socket, or X11
forwarding", and a wrapper that then has to decide which SQL is safe is the same losing game as a
Bash deny rule. Its honest use is to pin the agent to a *read-only replica's* `psql`, not to filter
statements.

### 2.2 Peer versus password, for the read-only role

Given a dedicated OS account, `peer` becomes *usable* rather than dangerous: a `local` record naming
only that OS user and only the identically named read-only role gives passwordless local access with
no credential on disk at all, and the OS account is the proof. The trade-off is that `peer` ties the
role name to the OS user name, and that one careless broader `peer` line later re-opens the hole,
whereas a `scram-sha-256` record fails closed if the password is absent. We would use
`scram-sha-256` with `~/.pgpass`: it is auditable in one file and it does not reward a mistake in
another.

### 2.3 What is left after this

An agent account with no `sudo`, no readable application credentials and no write access to code can
reach the database only as the role whose password it holds. If that role has no write privileges,
the writes in the original question are genuinely impossible — not "blocked", but unrepresentable in
the connection the agent has. **This pair, and only this pair, answers the question as asked.**

---

## 3. Claude Code's own controls, and their honest status

Short answer, from Anthropic's documentation rather than from our judgement: **they are convenience
guardrails, with one partial exception (OS-level sandboxing), and the documentation says so.**

### 3.1 `permissions.deny` on Bash: not a security boundary, in those words

The Permissions page has a section headed "What a Bash rule doesn't match":

> A Bash rule matches the command text Claude writes, after Claude Code splits compound commands and
> strips wrappers. It doesn't match the same program invoked in a different form, so **a deny or ask
> rule covers the invocation Claude usually produces and isn't a security boundary around the
> program.**
>
> — [Permissions](https://code.claude.com/docs/en/permissions)

The page then gives a table of exactly the evasions the question asks about:

| Rule | Stops | Doesn't stop |
| :-- | :-- | :-- |
| `Bash(rm *)` | `rm -rf build/` | `/bin/rm -rf build/`, `bash -c 'rm -rf build/'` |
| `Bash(curl *)` | `curl https://example.com` | `/usr/bin/curl https://example.com`, `sh -c 'curl https://example.com'` |

Transposed to our case: `deny: ["Bash(psql *)"]` does not stop `/usr/bin/psql`, `sh -c 'psql …'`, a
heredoc fed to a shell, `python -c "import psycopg…"`, `./manage.py dbshell`, or `./manage.py shell`.
Django makes two of those trivially available:

> Any arguments following a `--` divider will be passed on to the underlying command-line client. For
> example, with PostgreSQL you can use the `psql` command's `-c` flag to execute a raw SQL query
> directly: `django-admin dbshell -- -c 'select current_user'`
>
> — [django-admin and manage.py](https://docs.djangoproject.com/en/5.2/ref/django-admin/)

A rule naming `psql` does not see `dbshell`; a rule naming both does not see `python -c`.

In fairness, the rules are better than naive prefix matching in two respects. Deny rules are
evaluated on nested subcommands — the page says they "apply when any subcommand matches them,
including a command nested inside a subshell, a command substitution, or a control-flow body such as
a `for` loop" — and deny beats allow: "An allow rule can't carve an exception out of a deny rule."
Within the harness, the precedence is sound. The problem is not the precedence; it is that the
subject of the match is *text*.

The page's own recommendation, twice over, is to stop relying on text:

> For filesystem and network enforcement that doesn't depend on the command text, use sandboxing. To
> inspect the full command text with your own logic before it runs, use a PreToolUse hook.

and, in a warning box:

> Bash permission patterns that try to constrain command arguments are fragile. [...] **Add
> CLAUDE.md guidance**: describe your allowed curl patterns in `CLAUDE.md`. This shapes what Claude
> tries but doesn't enforce a boundary, so pair it with one of the options above.

"Shapes what Claude tries but doesn't enforce a boundary" is as clear a statement as we could want
about where a `CLAUDE.md` rule sits.

### 3.2 `PreToolUse` hooks: stronger, still not a boundary

A hook does see the real command. The documented `PreToolUse` input for a Bash call carries the full
string in `tool_input.command`, and a hook blocks either by exiting 2 or by returning
`permissionDecision: "deny"`. Exit 2 is forceful — it "stops the tool call before permission rules
are evaluated", and "Exit 2 blocks even when your hook prints JSON [...] Even a `permissionDecision`
of `"allow"` doesn't let the action through"
([Hooks](https://code.claude.com/docs/en/hooks), [Permissions](https://code.claude.com/docs/en/permissions)).

But the hooks documentation withholds exactly the guarantee we would need. On the command filter:

> Because the `if` filter is best-effort, **use the permission system rather than a hook to enforce a
> hard allow or deny.**

And on failure behaviour:

> On `PreToolUse`, a timed-out `command`, `http`, or `mcp_tool` hook doesn't block the tool call,
> except for hooks whose failure blocks the action [...] **so don't count on a stalled hook to act as
> a gate.**
>
> — [Hooks](https://code.claude.com/docs/en/hooks)

So the default failure mode is **fail-open**: a hook that hangs under load lets the command through.
Add to that the fact that hooks can be switched off from outside the session —
`--settings '{"disableAllHooks": true}'` is documented, and project settings outrank user settings
for that key — and a hook is a good tripwire and a bad wall. It also faces the same unbounded problem
as a deny rule: deciding whether an arbitrary shell command will eventually write to a database is
not decidable by inspection.

A hook's real value here is *detection and friction*: log every command that mentions a database, so
that a near-miss is visible afterwards.

### 3.3 Sandboxing: genuinely OS-enforced, and still not the answer for a remote host

This is the one agent-layer mechanism with a real kernel behind it:

> The operating system enforces the sandbox boundary on the running process, so it holds regardless of
> what the model chose to run.
>
> — [Sandboxing](https://code.claude.com/docs/en/sandboxing)

Backed by Seatbelt on macOS and bubblewrap on Linux/WSL2; on native Windows, "Claude Code runs
commands unsandboxed". Network egress goes through a local proxy checking each host against an
allowlist that "start[s] empty". That last point is interesting for us: a network allowlist that does
*not* include the production hosts would stop the agent reaching them at all, which is a real
boundary — but it is all-or-nothing, and it is the opposite of what we want, since we want diagnosis
to work.

The documentation is candid about the limits, and several bite directly:

> **Don't rely on any of the sandbox's restrictions, including protected paths and `credentials.files`
> entries, to stop a malicious command.**

> when the platform doesn't support the sandbox or the dependency check at startup fails, Claude Code
> runs commands without sandboxing

(fail-open unless `sandbox.failIfUnavailable` is `true`), and the sandbox covers shell commands only:
"Claude's file tools, MCP servers, and hooks run outside it." Claude can also retry a command with
`dangerouslyDisableSandbox`, which in `bypassPermissions` mode "runs without a prompt".

And the structural point for our case: the sandbox constrains *the local process tree*. When the
command is `ssh host '…'`, what runs on the far side is a process on the production host, started by
`sshd`, in no local sandbox at all. The local sandbox can decide *whether the SSH connection happens*;
it cannot constrain what happens after it. **Sandboxing does not address the production-host risk;
the remote Unix account does.** (The reasoning here is ours — see Unverified.)

### 3.4 `--dangerously-skip-permissions` / `bypassPermissions`

Documented plainly:

> In `bypassPermissions` mode, Claude Code skips permission prompts, including for writes to protected
> paths such as `.git` and `.claude`. [...] **Only use this mode in isolated environments like
> containers or VMs where Claude Code can't cause damage.**
>
> — [Permissions](https://code.claude.com/docs/en/permissions)

It can be disabled, and that part is genuinely enforceable *against the operator*:
`permissions.disableBypassPermissionsMode` set to `"disable"`, in managed settings, where "no other
level, including command line arguments, can override a managed permission rule". Worth deploying —
it stops a tired human from reaching for the flag — but note what it is and is not: it hardens the
agent layer against *us*, not against a shell wrapper. The mode's existence is also the clearest
possible evidence that the permission system was designed as a prompting policy rather than a
containment boundary.

### 3.5 Auto mode

Auto mode is described as: "A separate classifier model reviews actions instead of you and blocks the
ones it judges unsafe." A model's judgement is a good prior and not a boundary; the page's closing
warning covers the whole chapter:

> While these protections significantly reduce risk, no system is completely immune to all attacks.

---

## 4. Read-only replicas and copies

### 4.1 Hot standby: refusal from the server's state, not from a grant

This is the strongest mechanism available, and the reason is the quality of the enforcement rather
than its breadth. On a standby in recovery, the read-only property is not a privilege and not a
default — it is the server's mode:

> During hot standby, the parameter `transaction_read_only` is **always true and may not be changed**.
>
> — [Hot Standby](https://www.postgresql.org/docs/17/hot-standby.html)

Compare that with `default_transaction_read_only`, which any session may change. Here the escape
hatches are closed by name. The page lists, among the operations that produce errors:

- DML: "`INSERT`, `UPDATE`, `DELETE`, `MERGE`, `COPY FROM`, `TRUNCATE`"
- DDL: "`CREATE`, `DROP`, `ALTER`, `COMMENT`" — and "This restriction applies even to temporary
  tables"
- Row locks: "`SELECT ... FOR SHARE | UPDATE`, because row locks cannot be taken without updating the
  underlying data files"
- The mode-changing commands themselves: "`BEGIN READ WRITE`, `START TRANSACTION READ WRITE`,
  `SET TRANSACTION READ WRITE`, `SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE`, and
  `SET transaction_read_only = off`"
- Sequences: "`nextval()`, `setval()`"
- Administration: "`GRANT`, `REVOKE`, `REASSIGN`", "`ANALYZE`, `VACUUM`, `CLUSTER`, `REINDEX`"

And on connections generally: "All such connections are strictly read-only; not even temporary tables
may be written."

That list is a near-exact match for the prohibition in the original question, including the two items
privileges handle least gracefully: it covers *every* role on the server, and it removes the mode
switches rather than merely declining to grant them.

A standby also solves a problem the question did not raise. An agent exploring real data on the
**primary** can hurt production without writing anything: a sequential scan over a large table
competes for I/O, and a long-running read holds `ACCESS SHARE`, which can block an `ALTER TABLE`
during a deploy. Moving diagnosis off the primary removes that class of incident entirely.

**Costs, honestly:**

- **Physical replication is per cluster, not per database.** If the ten applications share one
  PostgreSQL cluster per host, one standby per host covers all ten and the cost is modest. If each
  application has its own cluster, it is ten standbys. This is the number that decides whether the
  replica route is cheap or expensive, and it is worth establishing before committing.
- A standby needs a replication slot and WAL retention on the primary; a slot for a standby that
  falls behind or is forgotten retains WAL and can fill the primary's disk. This is a new
  availability risk created by a safety measure, and it needs monitoring.
- Replication lag means the agent sees a slightly stale database. For diagnosis this is usually fine
  and occasionally confusing — and queries may be cancelled by recovery conflicts under lag.
- Some diagnostic habits stop working: no `CREATE TEMP TABLE` to stage intermediate results, no
  `EXPLAIN ANALYZE` of a write, no `SELECT ... FOR UPDATE`.
- A replica is a second full copy of real participant data, so it inherits every access-control and
  retention obligation the primary has. It is not a reduction in data-protection surface.

### 4.2 A periodically restored dump on a separate host

A nightly `pg_dump` restored onto a non-production host is weaker as a replica and stronger as a
boundary, because the production database is not reachable from the agent's environment at all. If
the agent writes, it writes to a copy, and the blast radius is a restore job.

It also offers something no replica can: **the restore is a place to anonymize.** For a
citizen-science project handling real participants, a diagnosis environment holding pseudonymized
data is a genuine reduction in risk, not merely a relocation of it. Set against that, the data is up
to a day stale, which rules it out for diagnosing anything happening now, and "it works on the copy"
is a familiar source of wasted time.

### 4.3 Assessment

Pointing agents at a replica rather than the primary **is** the cleaner answer, for one specific
reason: it is the only mechanism on this list where the thing being prevented is prevented by the
server's own state, with the mode switches explicitly removed, for every role. It does not replace the
role-and-account work — the agent still needs an account and a role on the replica host, and the
primary must stay unreachable for the arrangement to mean anything — but it converts "we have
withheld the privileges that would allow a write" into "this server cannot write", which is a better
sentence to have to defend.

The pragmatic reading: do the role-and-account work first, because it is cheap, immediate, and
required either way; add the standby once the per-cluster question in 4.1 is settled.

---

## 5. Connection-level intermediaries

**None of these enforce read-only. This whole category is a dead end for our purpose**, with the
qualification in 5.3.

### 5.1 pgbouncer

pgbouncer does not parse SQL for policy. Reading its configuration reference, the closest things to
what we want are not enforcement: `track_extra_parameters` happens to list
`default_transaction_read_only` among parameters it *tracks* across pooled connections, which
propagates a setting rather than imposing one; `connect_query` runs a statement at connection setup,
and the documentation says of it that "If the query raises errors, they are logged but ignored
otherwise" — so it cannot even fail closed. It does inspect query text when
`max_prepared_statements` is non-zero, but for prepared-statement bookkeeping, not filtering
([pgbouncer configuration](https://www.pgbouncer.org/config.html)).

A `connect_query` of `SET default_transaction_read_only = on` is therefore worth exactly what section
1.2 says it is worth: a default the session can unset, now also silently ignorable if it errors.

### 5.2 pgpool-II

pgpool-II *does* parse SQL — "We distinguish which query should be sent to which node by looking at
the query itself" — and classifies writes to the primary and plain `SELECT`s to standbys. But that is
routing, not refusal: the documentation describes no feature that rejects a write, and the
classification has documented soft edges. A `SELECT` calling a function that writes is treated as a
read unless the function is correctly listed, names must be listed both schema-qualified and
unqualified, and an SQL comment can suppress load balancing
([pgpool-II load balancing](https://www.pgpool.net/docs/latest/en/html/runtime-config-load-balancing.html)).

A mechanism that can be steered by a comment in the SQL is in the agent layer by definition.

### 5.3 A read-only Postgres MCP server

The first-party reference server is **archived**. The `modelcontextprotocol/servers` README lists the
maintained reference servers (Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, Time)
and says "The following reference servers are now archived and can be found at servers-archived";
PostgreSQL appears only under that heading, described as "Read-only database access with schema
inspection."

Its own README does document a read-only mode — "A Model Context Protocol server that provides
read-only access to PostgreSQL databases", a `query` tool that "Execute[s] read-only SQL queries", and
"All queries are executed within a READ ONLY transaction" — but notably **the README itself carries no
deprecation notice**, so a reader who arrives via the package rather than the repository sees a
maintained-looking read-only server that is not maintained.

The structural objection is more important than the archival status. "Executed within a READ ONLY
transaction" is section 1.2's mechanism. It is a `PGC_USERSET` default, and the SQL text is supplied
by the model. If the server passes the string through to a driver that accepts multiple
semicolon-separated statements, then `COMMIT; BEGIN READ WRITE; UPDATE …` is in scope. Third-party
write-ups claim exactly this flaw in the archived server; we found no advisory or CVE and have not
reproduced it, so we record it as reported, not established (see Unverified).

The generalisation is the part to keep, and it holds for any MCP server, first-party or not:

> **An MCP server is only as read-only as the role it connects as.** Its own "read-only mode" is a
> convenience on top of that; the credential is the boundary.

So: if we use a Postgres MCP server, we give it the read-only role's credential and treat its
read-only mode as a nicety. Done that way, a maintained third-party server is fine, because nothing
rests on it. Done the other way — a read-write credential and trust in the wrapper — the wrapper is
the only thing standing between the agent and the data, and it is a wrapper around text the agent
writes.

---

## 6. Django-specific angles

These are **app-level conventions**. They shape what the application does; they do not constrain what
a shell can do. Django's own documentation uses the vocabulary of suggestion.

**Database routers.** `db_for_read` and `db_for_write` are described as suggestions —
"Suggest the database that should be used for read operations", "Returns `None` if there is no
suggestion" — and the page states outright that "A manually specified database allocation will take
priority over a database allocated by a router"
([Multiple databases](https://docs.djangoproject.com/en/5.2/topics/db/multi-db/)). `QuerySet.using()`
and `obj.save(using=…)` therefore walk past any router. `allow_migrate` is firmer in effect — "if
`allow_migrate()` returns `False`, any migration operations for the `model_name` will be silently
skipped" — but it is still code in the repository, which the agent can read and edit, and
`migrate --database` names the target explicitly.

**A read-only connection in `DATABASES`.** Adding an alias whose credentials are the read-only role is
worth doing, because the *credential* is the boundary and the alias is just a convenient name for it.
Adding an alias that points at the same read-write credential and relying on a router to keep writes
away from it is worth nothing.

**Why none of this enforces anything.** The shortest demonstration is the one from 3.1:
`manage.py dbshell -- -c '…'` hands raw SQL to `psql` with the settings file's own credentials, and
`manage.py shell` gives a Python prompt with the connection already open. Both use the credentials in
`settings.py`, and both bypass every router in the project. The question is therefore never "what do
the routers permit?" but "which credential can this process read, and what may that role do?"

**The one Django-side item that does matter** is a consequence of section 2.1, step 3: the settings
or environment file holding the read-write password must not be readable by the agent's OS account.
That is a file mode, not a Django feature — which is the point.

---

## 7. Ranking: enforced by something the agent does not control

| # | Mechanism | Layer | Enforced by | Boundary? |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Agent reaches **only a hot standby**; primary unreachable | Server state | PostgreSQL recovery; `transaction_read_only` "always true and may not be changed" | **Yes.** Applies to every role; mode switches explicitly removed. |
| 2 | Agent reaches only a **restored (ideally anonymized) copy** on a separate host | Server state | The production data is not there | **Yes**, and it shrinks the data-protection surface. Stale. |
| 3 | **Dedicated OS account**: no `sudo`, cannot read app credentials, cannot write deployed code | Host | Kernel; file modes; `sudoers` | **Yes.** Without this, nothing below it holds. |
| 4 | **Role with no write privileges** (`pg_read_all_data`, no `pg_write_all_data`) | Server state | PostgreSQL privilege checks on every statement | **Yes**, provided #3 holds. |
| 5 | **`pg_hba.conf`** records per role; no `peer`/`trust` the agent can match | Host | `postgres` before authentication | **Yes**, as the gate that makes #4 the only reachable identity. |
| 6 | `REVOKE` ambient `PUBLIC` privileges; audit `SECURITY DEFINER` functions | Server state | PostgreSQL | **Yes** — closes a specific hole in #4. |
| 7 | `statement_timeout`, `idle_in_transaction_session_timeout` on the role | Server state | PostgreSQL | Yes, for availability; irrelevant to writes. |
| 8 | `disableBypassPermissionsMode` in **managed settings** | Agent (hardened) | Settings precedence: "no other level, including command line arguments, can override" | Against *us*, yes. Against a shell wrapper, no. |
| 9 | Claude Code **sandboxing** | Agent | OS (Seatbelt/bubblewrap) — "holds regardless of what the model chose to run" | Locally partial; fail-open by default; does not reach the far side of SSH. |
| 10 | `ALTER ROLE … SET default_transaction_read_only = on` | Server state (but a default) | Nothing — `PGC_USERSET` | **No.** Clear failure message, no boundary. |
| 11 | `PreToolUse` hook rejecting database commands | Agent | A script, fail-open on timeout; docs say don't use it as a hard deny | **No.** Useful tripwire. |
| 12 | `permissions.deny` on `Bash(psql *)` etc. | Agent | Text matching — "isn't a security boundary around the program" | **No.** |
| 13 | pgbouncer / pgpool read-only "enforcement" | Intermediary | Nothing / steerable routing | **No.** |
| 14 | An MCP server's read-only mode | Agent | A wrapper around text the agent writes | **No** by itself; fine on top of #4. |
| 15 | Django routers, `allow_migrate` | App | Project code the agent can read and edit | **No.** |
| 16 | `CLAUDE.md` instruction | Agent | The model's cooperation — "shapes what Claude tries but doesn't enforce a boundary" | **No.** |

Items 10 to 16 are not worthless; several are in the recommendation below. They are worthless *as the
answer to the question*, and the mistake to avoid is counting them as one.

---

## 8. Recommended arrangement, in order

**Phase 1 — the boundary (do this first; it is cheap and it is what the question asks for).**

Create the role. As a superuser, once per database:

```sql
-- No write privileges, no inheritance of any role that has them.
CREATE ROLE agent_ro
  LOGIN
  PASSWORD 'generated-high-entropy-secret'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
  CONNECTION LIMIT 4;

-- Reads everywhere, including tables created later (PostgreSQL 14+).
GRANT pg_read_all_data TO agent_ro;
GRANT CONNECT ON DATABASE <the_database> TO agent_ro;

-- Fast, legible failure on an accidental write, with no write privilege behind it.
-- NOT a boundary: the session can turn this off. See section 1.2.
ALTER ROLE agent_ro SET default_transaction_read_only = on;

-- Keep a curious agent from hurting production availability.
ALTER ROLE agent_ro SET statement_timeout = '30s';
ALTER ROLE agent_ro SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE agent_ro SET lock_timeout = '5s';
```

Before PostgreSQL 14, or where `pg_read_all_data` is unavailable, replace the `GRANT` with the
enumerated form — and accept the maintenance caveat from section 1.1:

```sql
GRANT USAGE ON SCHEMA public TO agent_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_ro;

-- Must name the role that actually runs CREATE TABLE (i.e. whoever runs `migrate`).
ALTER DEFAULT PRIVILEGES FOR ROLE <migrating_role> IN SCHEMA public
  GRANT SELECT ON TABLES TO agent_ro;
```

Close the ambient privileges, per database:

```sql
REVOKE TEMPORARY ON DATABASE <the_database> FROM PUBLIC;
REVOKE CONNECT   ON DATABASE <the_database> FROM PUBLIC;
GRANT  CONNECT   ON DATABASE <the_database> TO <the_application_role>, agent_ro;
```

Then audit for `SECURITY DEFINER` functions that write and are executable by `PUBLIC` — the one hole
a SELECT-only role does not close:

```sql
SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner) AS owner, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
  AND n.nspname NOT IN ('pg_catalog', 'information_schema');
```

Verify the role, as the role:

```sql
SELECT current_user, pg_has_role(current_user, 'pg_write_all_data', 'USAGE');  -- expect false
CREATE TABLE should_fail (i int);                      -- expect: permission denied for schema
BEGIN READ WRITE; UPDATE <some_table> SET id = id;     -- expect: permission denied for table
```

The second and third must fail on *privileges*, not on "read-only transaction". If the message says
read-only transaction, the privileges are wrong and only the courtesy default is holding.

`pg_hba.conf` — tight records above broad ones, because the first match wins and there is no
fall-through:

```
# TYPE  DATABASE          USER      ADDRESS       METHOD
local   <the_database>    agent_ro                scram-sha-256
host    <the_database>    agent_ro  127.0.0.1/32  scram-sha-256

# ... existing application records ...

# Nothing below may be broad enough for the agent's OS account to match, and
# in particular no `local all all peer` and no `trust` anywhere.
```

The OS account — all six steps of section 2.1. The ones most often skipped are steps 3 and 4, and
they are the ones that decide whether the role above means anything. Verify positively, logged in as
the agent account:

```sh
sudo -n true                      # must fail
id                                # no sudo / wheel / adm / administrative groups
psql -U postgres -d postgres      # must fail
cat <the app's settings/env file> # must fail: permission denied
test -w <the deployed code dir>   # must fail
psql "dbname=<db> user=agent_ro"  # must succeed, read-only
```

Set `~/.pgpass` to mode `0600` with only the read-only role's entry.

**Phase 2 — defence in depth inside the agent layer (hours; each item is a tripwire, not a wall).**

- Managed settings: `permissions.disableBypassPermissionsMode: "disable"`, and
  `sandbox.failIfUnavailable: true` if sandboxing is on, so it stops failing open.
- `permissions.deny` for `Bash(psql *)`, `Bash(pg_dump *)`, `Bash(*manage.py migrate*)`,
  `Bash(*manage.py shell*)`, `Bash(*manage.py dbshell*)`. These stop the invocation an agent
  *actually* produces most of the time, which is worth real money in reduced near-misses — while
  being, by Anthropic's own words, not a boundary.
- A `PreToolUse` hook that **logs** every Bash command matching a database pattern, and denies the
  obvious ones. Treat its output as an audit trail to read, not as a gate.
- A line in `CLAUDE.md`: diagnosis connects as the read-only role (or to the replica); writes to
  production go through migrations and the deploy path. This shapes behaviour and enforces nothing,
  which is precisely why it comes last.

**Phase 3 — the strongest layer (days; decide after settling the per-cluster question in 4.1).**

- Establish whether the ten applications share a cluster per host or have one each. This single fact
  decides whether the standby route costs one server or ten.
- Stand up a hot standby and give the agent account access to **that** host only, with the primary
  unreachable from it. At that point the prohibition is in the server's recovery state rather than in
  a grant table, and it holds for every role.
- Separately, consider an anonymized restored copy for work that does not need live data. It is the
  only option on this list that reduces the amount of real participant data exposed to agents rather
  than relocating it.

---

## 9. Failure modes, per layer

**Role with no write privileges (#4).**
- *The agent reads the application's credentials and connects as the application.* The most likely
  failure by a wide margin, and it defeats the layer completely. Mitigated only by file modes on the
  host (2.1 step 3).
- *A new table is invisible.* Only if the enumerated-`GRANT` route was used; `pg_read_all_data` is
  immune. Fails safe.
- *A `SECURITY DEFINER` function executable by `PUBLIC` performs a write.* Real hole; found by the
  query in section 8.
- *Row-level security hides rows from diagnosis*, since `pg_read_all_data` has no `BYPASSRLS`. Fails
  safe, may frustrate.
- *A superuser connection remains reachable* because a `peer` or `trust` record matches the agent's
  OS account. Then the layer is never consulted.

**OS account (#3).**
- *Group creep.* Someone adds the account to `sudo`, or to a group with administrative control over a
  service manager or container daemon, to unblock a task. Needs a periodic check of `id` and of group
  files, not a one-time setup.
- *The same SSH key in a second `authorized_keys`.* Silently reinstates every privilege the other
  account has.
- *A credential readable through a path nobody thought of:* a CI checkout, a backup script, a
  container environment file, a systemd unit with `Environment=`, a stale `.env.bak`, a world-readable
  log that echoed a connection string.
- *Write access to deployed code*, which makes the application the agent's write primitive.

**`pg_hba.conf` (#5).**
- *A broad record above the specific one*, or a specific record added below a catch-all, where it has
  no effect at all.
- *Edits lost on package upgrade or by configuration management* that rewrites the file.
- *`md5` where `scram-sha-256` was intended* — a weaker superset, since `md5` means "SCRAM-SHA-256 or
  MD5".

**Hot standby (#1).**
- *A replication slot for a forgotten or lagging standby retains WAL and fills the primary's disk.* A
  safety measure creating an availability risk; needs monitoring with teeth.
- *Lag causes confusion or query cancellation under recovery conflicts.*
- *Diagnostic habits break*: no temp tables, no `EXPLAIN ANALYZE` of writes, no `SELECT … FOR UPDATE`.
- *The primary turns out to be reachable anyway* from the agent's account, which makes the standby
  decoration.
- *Promotion.* A standby promoted during an incident becomes writable; if the agent's access follows
  it, the boundary evaporates at the worst possible moment. Worth an explicit runbook line.
- *A second full copy of participant data* to protect and eventually dispose of.

**Restored copy (#2).**
- *Staleness* makes it useless for live incidents.
- *The restore pipeline itself* needs credentials on both ends and becomes a new path to the data.
- *Anonymization that is incomplete* yields something that feels safe and is not — arguably worse than
  an honest copy.

**Agent-layer items (#8–#16).**
- *Being mistaken for the boundary.* This is the significant failure mode of the whole group, and it
  is a human one: a deny rule and a `CLAUDE.md` line produce a visible, legible, reassuring artifact,
  and the reassurance is not proportional to the protection. Anthropic's documentation says it in
  plain words; the risk is that we read the rule and not the documentation.
- *Deny rules defeated by an absolute path, `sh -c`, a heredoc, a Python script, or
  `manage.py dbshell -- -c` — documented, with a table.*
- *A hook that times out and fails open*, documented: "don't count on a stalled hook to act as a
  gate."
- *Hooks disabled from the command line* with `--settings '{"disableAllHooks": true}'`.
- *Sandbox fails open* when unavailable, unless `failIfUnavailable` is set; does not cover MCP
  servers, file tools or hooks; does not constrain the far side of an SSH connection.

---

## 10. Flagged: what we could not verify from a primary source

- **Whether a superuser can write on a hot standby.** The Hot Standby page says
  `transaction_read_only` is "always true and may not be changed" and never mentions superusers, so
  the restriction appears to apply to every role. The documentation does not say so explicitly. We
  are relying on an inference from the absence of an exception; it should be tested on the actual
  version before it is used as an argument.
- **Whether PostgreSQL superusers bypass privilege checks in general.** The privileges chapter
  implies it — "only the owner (or a superuser) can do anything with the object" — without stating it
  as a rule. Our reasoning in section 2 does not depend on the general claim, only on `peer` granting
  the superuser identity, which is documented.
- **The reported multi-statement flaw in the archived Postgres MCP server.** Third-party write-ups
  claim the archived server passed a bare SQL string to a driver accepting semicolon-separated
  statements, which would let `COMMIT; BEGIN READ WRITE; …` escape the read-only transaction. We
  found no advisory and no CVE, and we have not reproduced it. Recorded as reported. The
  recommendation in 5.3 does not depend on it: a read-only credential makes the question moot.
- **That Claude Code's sandbox cannot constrain a process started on the far side of an SSH
  connection.** This follows from the documented scope — an OS-enforced boundary "around the shell
  commands Claude runs on your machine", with network egress passing through a local proxy — but the
  documentation does not discuss SSH. The conclusion is ours.
- **Whether membership of a container-daemon group is root-equivalent.** Widely asserted; Docker's
  own security page does not say it. What it does say is "only trusted users should be allowed to
  control your Docker daemon" and that a container "can alter your host filesystem without any
  restriction", which is enough to justify keeping the agent account out of such groups without
  resting on the stronger claim.
- **Any version-specific behaviour on our actual servers.** Everything above is read from the
  PostgreSQL 16/17 manual, the PostgreSQL 17 source, Django 5.2 and Anthropic's current
  documentation. Per-host versions, existing `pg_hba.conf` contents and current group memberships are
  operational facts that belong in internal notes, and the Phase 1 verification commands are written
  so that each assumption is checked rather than assumed.

## Sources

PostgreSQL 17 manual: [Predefined Roles](https://www.postgresql.org/docs/17/predefined-roles.html) ·
[Client Connection Defaults](https://www.postgresql.org/docs/17/runtime-config-client.html) ·
[SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html) ·
[ALTER ROLE](https://www.postgresql.org/docs/17/sql-alterrole.html) ·
[Parameter Interaction via SQL](https://www.postgresql.org/docs/17/config-setting.html) ·
[`pg_settings`](https://www.postgresql.org/docs/17/view-pg-settings.html) ·
[Privileges](https://www.postgresql.org/docs/17/ddl-priv.html) ·
[GRANT](https://www.postgresql.org/docs/17/sql-grant.html) ·
[ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html) ·
[The pg_hba.conf File](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html) ·
[Event Triggers](https://www.postgresql.org/docs/17/event-triggers.html) ·
[Event Trigger Firing Matrix](https://www.postgresql.org/docs/17/event-trigger-matrix.html) ·
[CREATE EVENT TRIGGER](https://www.postgresql.org/docs/17/sql-createeventtrigger.html) ·
[Hot Standby](https://www.postgresql.org/docs/17/hot-standby.html).
PostgreSQL source: [`guc_tables.c`, REL_17_STABLE](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/misc/guc_tables.c).
Anthropic: [Claude Code Security](https://code.claude.com/docs/en/security) ·
[Permissions](https://code.claude.com/docs/en/permissions) ·
[Hooks](https://code.claude.com/docs/en/hooks) ·
[Sandboxing](https://code.claude.com/docs/en/sandboxing).
Other: [pgbouncer configuration](https://www.pgbouncer.org/config.html) ·
[pgpool-II load balancing](https://www.pgpool.net/docs/latest/en/html/runtime-config-load-balancing.html) ·
[MCP reference servers](https://github.com/modelcontextprotocol/servers) and the
[archived Postgres server README](https://github.com/modelcontextprotocol/servers-archived/blob/main/src/postgres/README.md) ·
Django 5.2 [Multiple databases](https://docs.djangoproject.com/en/5.2/topics/db/multi-db/) and
[django-admin](https://docs.djangoproject.com/en/5.2/ref/django-admin/) ·
[sshd_config(5)](https://man.openbsd.org/sshd_config.5) ·
[Docker security](https://docs.docker.com/engine/security/).
