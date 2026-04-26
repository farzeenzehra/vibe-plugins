---
name: end
description: End a relay team in this terminal. Removes the relay MCP server from this project's .claude/settings.local.json and (the first time it runs) deletes ~/.claude/relay/<team-name>/. Run in every terminal that joined to fully clean up. Use when the relay session is done, before re-creating a team with the same name, or to recover from a broken state.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

End the relay team named "$team_name" in this terminal.

## Step 1 — Resolve paths

Determine:
- HOME (Bash: `echo $HOME`; Node: `node -e "console.log(require('os').homedir())"`)
- CWD (Bash: `pwd`)

Use forward-slash form. Define:
- TEAM_DIR = `HOME/.claude/relay/$team_name`
- SETTINGS_PATH = `CWD/.claude/settings.local.json`

## Step 2 — Remove the MCP server from this project's settings.local.json

If `SETTINGS_PATH` does not exist, print: `(no .claude/settings.local.json here — nothing to unregister)`.

Otherwise read it. If `mcpServers["relay-$team_name"]` exists, delete that key and write the file back. Print: `✓ Removed MCP server "relay-$team_name" from CWD/.claude/settings.local.json`.

If it does not exist, print: `(MCP server "relay-$team_name" was not registered in this terminal)`.

If `mcpServers` becomes empty after the removal, you may either leave it as `{}` or delete the key — both are fine.

## Step 3 — Delete the shared team directory (only the lead terminal's run will hit this)

If `TEAM_DIR` exists, delete it recursively (Bash: `rm -rf "<TEAM_DIR>"`).

Print: `✓ Deleted TEAM_DIR` or `(team directory was already gone — another terminal already cleaned it up)`.

Note: the team directory at `~/.claude/relay/$team_name/` is **shared** across all terminals in the team. Only one terminal needs to delete it, and other terminals' MCP subprocesses will start failing once it's gone (they restart on the next Claude Code restart).

## Step 4 — Print restart hint

Print exactly:

Relay team "$team_name" cleaned up in this terminal.

To fully unload the MCP server here, restart Claude Code (resume the conversation if you want to keep context).

Other terminals that joined this team should also run:
  /relay:end $team_name
…in their own project directories — each one needs to clean its own settings.local.json.
