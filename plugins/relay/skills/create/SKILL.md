---
name: create
description: Create a relay team in the lead terminal. Use whenever the user wants two or more Claude Code terminals to message each other while keeping their existing conversation context (unlike /squad:add-agent which starts a fresh agent session). Sets up an MCP messaging server in ~/.claude/relay/<team-name>/, runs npm install, and registers the server via `claude mcp add --scope local` (per-project-path, so two terminals in different projects get isolated configs without committing anything to either repo). After it runs, the user must restart Claude Code once and choose "Resume previous conversation".
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

Set up a relay team named "$team_name" rooted in this terminal as the lead.

The plugin's bundled server lives at `${CLAUDE_PLUGIN_ROOT}/server/server.js` and `${CLAUDE_PLUGIN_ROOT}/server/package.json`. The shared team runtime directory lives inside the active Claude data dir. The MCP server registration uses **`claude mcp add --scope local`** (the default scope), which writes the server into `~/.claude.json` under THIS terminal's current project path. Different terminals in different project dirs get isolated entries — each with its own `RELAY_NAME` — without polluting any project repo.

## Step 1 — Resolve paths

Determine `HOME` (Bash: `echo $HOME`; Node: `node -e "console.log(require('os').homedir())"`). Use forward-slash form throughout.

Detect the active Claude data dir from the `CLAUDE_CONFIG_DIR` env var (Claude Code injects this into every skill run):

```bash
CLAUDE_DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

Use forward-slash form (on Windows, convert backslashes).

Define:
- TEAM_DIR = `CLAUDE_DATA_DIR/relay/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`

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
- `${CLAUDE_PLUGIN_ROOT}/server/server.js` → `SERVER_PATH`
- `${CLAUDE_PLUGIN_ROOT}/server/package.json` → `TEAM_DIR/package.json`

(Use Bash `cp` or read+write — either is fine.)

## Step 4 — Install dependencies

Run `npm install` inside `TEAM_DIR`. This pulls in `@modelcontextprotocol/sdk`.

If the command fails, print the error and stop — do NOT register the MCP server, otherwise the user gets a broken setup on next start.

Print: `✓ Dependencies installed in TEAM_DIR`.

## Step 5 — Register the MCP server with `claude mcp add`

Run this command (replacing `<TEAM_DIR>` and `<SERVER_PATH>` with the resolved forward-slash paths). The `=` after each option is required — the CLI's `--env` is variadic and would otherwise eat the server name:

```
claude mcp add --transport=stdio --env=RELAY_TEAM=$team_name --env=RELAY_NAME=lead --env=RELAY_ROLE=lead --env=RELAY_DIR=<TEAM_DIR> relay-$team_name -- node <SERVER_PATH>
```

If `<TEAM_DIR>` or `<SERVER_PATH>` contain spaces, wrap the whole `--env=…` token (or the path arg) in double quotes — e.g. `"--env=RELAY_DIR=C:/Users/some name/.claude/relay/team"`.

If the command fails (e.g., `claude` not on PATH, or `relay-$team_name` already exists in this project's local scope), print stderr and stop.

Print: `✓ Registered "relay-$team_name" via claude mcp add (scope=local, scoped to this project path)`.

## Step 6 — Print restart instructions

Print exactly:

Relay team "$team_name" is set up.

The MCP server is registered to THIS terminal's project path (entry in ~/.claude.json). It won't appear in any other project — that's how each terminal in this team gets its own RELAY_NAME.

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude --channels server:relay-$team_name` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.

The --channels flag enables real-time push delivery — incoming messages appear in your session the moment they're sent, no polling needed. Your conversation context is fully preserved.

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member
  - relay_members()           list registered members

To verify the server is registered, run: `claude mcp list`

To bring another terminal into this team, in that terminal's project directory run:
  /relay:join $team_name <agent-name>

To clean up later (run in each terminal that joined):
  /relay:end $team_name
