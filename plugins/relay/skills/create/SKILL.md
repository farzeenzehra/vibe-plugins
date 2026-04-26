---
name: create
description: Create a relay team in the lead terminal. Use whenever the user wants two or more Claude Code terminals to message each other while keeping their existing conversation context (unlike /squad:add-agent which starts a fresh agent session). Sets up an MCP messaging server in ~/.claude/relay/<team-name>/, runs npm install, and registers the server in ~/.claude/settings.json. After it runs, the user must restart Claude Code once and choose "Resume previous conversation".
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

Set up a relay team named "$team_name" rooted in this terminal as the lead.

The plugin's bundled server source lives at `${CLAUDE_PLUGIN_ROOT}/server/server.js` and `${CLAUDE_PLUGIN_ROOT}/server/package.json`. The team's runtime directory will be `<HOME>/.claude/relay/$team_name`.

## Step 1 — Resolve paths

Determine the user's home directory (Bash: `echo $HOME`; PowerShell: `$env:USERPROFILE`; or Node: `node -e "console.log(require('os').homedir())"`). Use forward-slash form throughout (works on Windows and POSIX). Refer to it as HOME below.

Define:
- TEAM_DIR = `HOME/.claude/relay/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`

## Step 2 — Bail out if the team already exists

If `TEAM_DIR` already exists, print:

  Relay team "$team_name" already exists at TEAM_DIR.
  To rebuild it from scratch, run:
    /relay:end $team_name
  Then re-run this command.

And stop.

## Step 3 — Create the team directory and copy server files

Create `TEAM_DIR` (recursively).

Copy:
- `${CLAUDE_PLUGIN_ROOT}/server/server.js` → `TEAM_DIR/server.js`
- `${CLAUDE_PLUGIN_ROOT}/server/package.json` → `TEAM_DIR/package.json`

(Use Bash `cp` or read+write with the Read/Write tools — either is fine.)

## Step 4 — Install dependencies

Run `npm install` inside `TEAM_DIR`. This pulls in `@modelcontextprotocol/sdk`.

If the command fails (npm not on PATH, network error, etc.), print the error and stop — do NOT touch settings.json yet, otherwise the user will get a broken MCP server on next start.

Print: `✓ Dependencies installed in TEAM_DIR`.

## Step 5 — Register the MCP server in ~/.claude/settings.json

Read `HOME/.claude/settings.json`. If the file does not exist or is empty, treat its contents as `{}`.

Ensure there is an `mcpServers` object. Set `mcpServers["relay-$team_name"]` to:

```
{
  "command": "node",
  "args": ["<SERVER_PATH>"],
  "env": {
    "RELAY_TEAM": "$team_name",
    "RELAY_NAME": "lead",
    "RELAY_ROLE": "lead",
    "RELAY_DIR": "<TEAM_DIR>"
  }
}
```

Replace `<SERVER_PATH>` and `<TEAM_DIR>` with the actual forward-slash absolute paths. Write the updated JSON back, preserving any other keys in the settings file.

If `mcpServers["relay-$team_name"]` already existed (it shouldn't, since Step 2 bailed), overwrite it.

Print: `✓ Registered MCP server "relay-$team_name" in settings.json`.

## Step 6 — Print restart instructions

Print exactly:

Relay team "$team_name" is set up.

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member
  - relay_receive()           read and clear your inbox
  - relay_members()           list registered members

To bring another terminal into this team, run there:
  /relay:join $team_name <agent-name>

To clean everything up later:
  /relay:end $team_name
