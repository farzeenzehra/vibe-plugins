# Open items

Things to do later, kept here so they don't get lost.

## relay

- **Guard against two Claude sessions in the same cwd.** Today, if a user starts `claude` twice in the same project dir, both subprocesses load the same `~/.claude/relay/identities/<hash>.json` and race each other on the inbox — incoming messages flip-flop between the two terminals, outgoing messages are indistinguishable from each other. The skills already block setting up two *different* identities in one cwd, but they don't catch this same-identity twin case. Possible approaches: PID/lock file written by the server on startup, or a runtime check that there isn't already a server process for this hash. Low priority — it's a foot-gun, not a default failure mode, and the docs already say "use a different project directory per terminal".

## relay-desktop (planned)

- Implement the plan at `docs/superpowers/plans/2026-04-28-relay-desktop.md`.
