---
name: join
description: Join an existing relay team from a second (or third, etc.) terminal. Run this AFTER the lead terminal has run /relay:create. Adds the relay MCP server to THIS terminal's project-local .claude/settings.local.json with a different RELAY_NAME so messages can be routed to it. After it runs, the user must restart Claude Code once and choose "Resume previous conversation" to keep their context.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
allowed-tools: Bash Read Write
---

Join the relay team "$team_name" as "$agent_name".

This skill writes to **project-local** settings (`CWD/.claude/settings.local.json`), not user-global settings. That's important: it means you must run this in a different project directory than the lead terminal, so the two terminals' `RELAY_NAME` values don't collide.

## Step 1 — Resolve paths

Determine:
- HOME (Bash: `echo $HOME`; Node: `node -e "console.log(require('os').homedir())"`)
- CWD (Bash: `pwd`)

Use forward-slash form. Define:
- TEAM_DIR = `HOME/.claude/relay/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`
- SETTINGS_PATH = `CWD/.claude/settings.local.json`

**Sanity check:** if CWD equals HOME, print:

  This terminal is running Claude from your HOME directory, not a project.
  Relay needs each terminal to be in a different project directory. Re-open
  Claude inside a project (a different one from the lead terminal) and try again.

And stop.

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

## Step 4 — Register the MCP server in this project's settings.local.json

Ensure `CWD/.claude/` exists (create it if needed).

Read `SETTINGS_PATH`. If the file does not exist or is empty, treat its contents as `{}`.

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

Replace `<SERVER_PATH>` and `<TEAM_DIR>` with the actual forward-slash absolute paths. Write the updated JSON back, preserving any other keys.

If `mcpServers["relay-$team_name"]` already exists in THIS file (you're re-joining with a different name), overwrite it.

Print: `✓ Registered MCP server "relay-$team_name" as "$agent_name" in CWD/.claude/settings.local.json`.

## Step 5 — Print restart instructions

Print exactly:

Joined relay team "$team_name" as "$agent_name".

This terminal's relay config lives at:
  CWD/.claude/settings.local.json
(If your project's .gitignore doesn't already cover .claude/settings.local.json, add it — that file is per-developer and shouldn't be committed.)

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
