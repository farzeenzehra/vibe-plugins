---
name: create
description: Create a relay team in the lead terminal. Use whenever the user wants two or more Claude Code terminals to message each other while keeping their existing conversation context (unlike /squad:add-agent which starts a fresh agent session). Sets up an MCP messaging server in ~/.claude/relay/<team-name>/, runs npm install, and registers it in this project's .claude/settings.local.json (project-local, so two terminals in different projects don't conflict). After it runs, the user must restart Claude Code once and choose "Resume previous conversation".
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

Set up a relay team named "$team_name" rooted in this terminal as the lead.

The plugin's bundled server lives at `${CLAUDE_PLUGIN_ROOT}/server/server.js` and `${CLAUDE_PLUGIN_ROOT}/server/package.json`. The team's runtime directory is shared across terminals at `<HOME>/.claude/relay/$team_name`. The MCP server registration is **project-local** to this terminal's working directory — that's how a second terminal in a different project can have its own RELAY_NAME without overwriting this one.

## Step 1 — Resolve paths

Determine:
- HOME (Bash: `echo $HOME`; Node: `node -e "console.log(require('os').homedir())"`)
- CWD (Bash: `pwd`)

Use forward-slash form throughout.

Define:
- TEAM_DIR = `HOME/.claude/relay/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`
- SETTINGS_PATH = `CWD/.claude/settings.local.json`

**Sanity check:** if CWD equals HOME, print:

  This terminal is running Claude from your HOME directory, not a project.
  Relay needs each terminal to be in a different project directory so each
  gets its own .claude/settings.local.json. Re-open Claude inside a project
  and try again.

And stop.

## Step 2 — Bail if the team already exists

If `TEAM_DIR` exists, print:

  Relay team "$team_name" already exists at TEAM_DIR.
  To rebuild it from scratch, run:
    /relay:end $team_name
  in any terminal that joined, then re-run this command.

And stop.

## Step 3 — Create the team directory and copy server files

Create `TEAM_DIR` (recursively).

Copy:
- `${CLAUDE_PLUGIN_ROOT}/server/server.js` → `TEAM_DIR/server.js`
- `${CLAUDE_PLUGIN_ROOT}/server/package.json` → `TEAM_DIR/package.json`

(Use Bash `cp` or read+write with the Read/Write tools — either is fine.)

## Step 4 — Install dependencies

Run `npm install` inside `TEAM_DIR`. This pulls in `@modelcontextprotocol/sdk`.

If the command fails (npm not on PATH, network error, etc.), print the error and stop — do NOT touch settings.local.json yet, otherwise the user will get a broken MCP server on next start.

Print: `✓ Dependencies installed in TEAM_DIR`.

## Step 5 — Register the MCP server in this project's settings.local.json

Ensure `CWD/.claude/` exists (create it if needed).

Read `SETTINGS_PATH`. If the file does not exist or is empty, treat its contents as `{}`.

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

Replace `<SERVER_PATH>` and `<TEAM_DIR>` with the actual forward-slash absolute paths. Write the updated JSON back, preserving any other keys in the file.

Print: `✓ Registered MCP server "relay-$team_name" in CWD/.claude/settings.local.json`.

## Step 6 — Print restart instructions

Print exactly:

Relay team "$team_name" is set up.

This terminal's relay config lives at:
  CWD/.claude/settings.local.json
(If your project's .gitignore doesn't already cover .claude/settings.local.json, add it — that file is per-developer and shouldn't be committed.)

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member
  - relay_receive()           read and clear your inbox
  - relay_members()           list registered members

To bring another terminal into this team, in that terminal's project directory run:
  /relay:join $team_name <agent-name>

To clean everything up later (run in each terminal that joined):
  /relay:end $team_name
