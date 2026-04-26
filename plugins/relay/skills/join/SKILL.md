---
name: join
description: Join an existing relay team from a second (or third, etc.) terminal. Run this AFTER the lead terminal has run /relay:create. Adds the same MCP server to this terminal's settings.json with a different RELAY_NAME so messages can be routed to it. After it runs, the user must restart Claude Code once and choose "Resume previous conversation" to keep their context.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
allowed-tools: Read Write
---

Join the relay team "$team_name" as "$agent_name".

## Step 1 — Resolve paths

Determine the user's home directory (Bash: `echo $HOME`; PowerShell: `$env:USERPROFILE`; or Node: `node -e "console.log(require('os').homedir())"`). Use forward-slash form. Refer to it as HOME below.

Define:
- TEAM_DIR = `HOME/.claude/relay/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`

## Step 2 — Verify the team exists

Check that `SERVER_PATH` exists.

If it does not, print:

  Relay team "$team_name" not found at TEAM_DIR.
  In the lead terminal, run:
    /relay:create $team_name
  Then re-run this command here.

And stop.

## Step 3 — Sanity check the agent name

If `$agent_name` is `"lead"`, print:

  The name "lead" is reserved for the terminal that ran /relay:create.
  Pick a different agent name (e.g. "agent1", "fe", "backend").

And stop.

## Step 4 — Register the MCP server in ~/.claude/settings.json

Read `HOME/.claude/settings.json`. If the file does not exist or is empty, treat its contents as `{}`.

Ensure there is an `mcpServers` object. Set `mcpServers["relay-$team_name"]` to:

```
{
  "command": "node",
  "args": ["<SERVER_PATH>"],
  "env": {
    "RELAY_TEAM": "$team_name",
    "RELAY_NAME": "$agent_name",
    "RELAY_ROLE": "agent",
    "RELAY_DIR": "<TEAM_DIR>"
  }
}
```

Replace `<SERVER_PATH>` and `<TEAM_DIR>` with the actual forward-slash absolute paths. Write the updated JSON back, preserving any other keys in the settings file.

If `mcpServers["relay-$team_name"]` already exists in this terminal's settings, overwrite it (the user may be re-joining under a different agent name).

Print: `✓ Registered MCP server "relay-$team_name" as "$agent_name" in settings.json`.

## Step 5 — Print restart instructions

Print exactly:

Joined relay team "$team_name" as "$agent_name".

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member (e.g. to="lead")
  - relay_receive()           read and clear your inbox
  - relay_members()           list registered members

To leave the team later:
  /relay:end $team_name
