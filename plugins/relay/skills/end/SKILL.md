---
name: end
description: End a relay team in this terminal. Removes the relay MCP server from this terminal's local-scope project entry in ~/.claude.json (via `claude mcp remove`) and (the first time it runs) deletes the shared ~/.claude/relay/<team-name>/. Run in every terminal that joined to fully clean up. Use when the relay session is done, before re-creating a team with the same name, or to recover from a broken state.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

End the relay team named "$team_name" in this terminal.

## Step 1 — Resolve paths

Determine `HOME` (Bash: `echo $HOME`; Node: `node -e "console.log(require('os').homedir())"`). Use forward-slash form.

Define TEAM_DIR = `HOME/.claude/relay/$team_name`.

## Step 2 — Remove the MCP server with `claude mcp remove`

Run:

```
claude mcp remove relay-$team_name
```

If the command exits 0, print: `✓ Removed MCP server "relay-$team_name" from this project's local scope`.

If it errors with "not found" (or similar), print: `(MCP server "relay-$team_name" was not registered in this terminal — already removed or never added)`.

If `claude` is not on PATH, print the error but continue to step 3.

## Step 3 — Delete the shared team directory

If `TEAM_DIR` exists, delete it recursively (Bash: `rm -rf "<TEAM_DIR>"`).

Print: `✓ Deleted TEAM_DIR` or `(team directory was already gone — another terminal already cleaned it up)`.

Note: the team directory at `~/.claude/relay/$team_name/` is **shared** across all terminals in the team. Only one terminal needs to delete it. Other terminals' MCP subprocesses will start failing once it's gone, and their `claude mcp` registration is harmless leftover until they run `/relay:end $team_name` themselves.

## Step 4 — Print restart hint

Print exactly:

Relay team "$team_name" cleaned up in this terminal.

To fully unload the MCP server here, restart Claude Code (resume the conversation if you want to keep context).

Other terminals that joined this team should also run:
  /relay:end $team_name
…in their own project directories — each one needs to remove its own entry from ~/.claude.json.
