---
name: end
description: End a relay team. Removes the relay MCP server from this terminal's ~/.claude/settings.json and deletes ~/.claude/relay/<team-name>/. Run in every terminal that joined to fully clean up. Use when the relay session is done, before re-creating a team with the same name, or to recover from a broken state.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

End the relay team named "$team_name" in this terminal.

## Step 1 — Resolve paths

Determine the user's home directory (Bash: `echo $HOME`; PowerShell: `$env:USERPROFILE`; or Node: `node -e "console.log(require('os').homedir())"`). Use forward-slash form. Refer to it as HOME below.

Define TEAM_DIR = `HOME/.claude/relay/$team_name`.

## Step 2 — Remove the MCP server from settings.json

Read `HOME/.claude/settings.json`. If the file does not exist, skip this step and print: `(no settings.json found — nothing to unregister)`.

If `mcpServers["relay-$team_name"]` exists, delete that key and write the file back. Print: `✓ Removed MCP server "relay-$team_name" from settings.json`.

If it does not exist, print: `(MCP server "relay-$team_name" was not registered in this terminal)`.

If `mcpServers` becomes empty after the removal, you may either leave it as `{}` or delete the key — both are fine.

## Step 3 — Delete the team directory

If `TEAM_DIR` exists, delete it recursively (Bash: `rm -rf "<TEAM_DIR>"`; PowerShell: `Remove-Item -Recurse -Force "<TEAM_DIR>"`).

Print: `✓ Deleted TEAM_DIR` or `(team directory was already gone)`.

Note: if other terminals joined this team, they still have the MCP server in their own settings.json pointing at the now-deleted `TEAM_DIR`. They must run `/relay:end $team_name` themselves to clean up.

## Step 4 — Print restart hint

Print exactly:

Relay team "$team_name" cleaned up.

To fully unload the MCP server in THIS terminal, restart Claude Code (resume the conversation if you want to keep context). Other terminals that joined this team should also run:
  /relay:end $team_name
