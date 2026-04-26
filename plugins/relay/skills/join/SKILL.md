---
name: join
description: Join an existing relay team from a second (or third, etc.) terminal. Run this AFTER the lead terminal has run /relay:create. Registers the relay MCP server in THIS terminal's local-scope (per-project-path) entry of ~/.claude.json with a different RELAY_NAME so messages can be routed to it. After it runs, the user must restart Claude Code once and choose "Resume previous conversation" to keep their context.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
allowed-tools: Bash Read Write
---

Join the relay team "$team_name" as "$agent_name".

This skill uses `claude mcp add --scope local` (the default), which stores the server config in `~/.claude.json` under THIS terminal's current project path. Run this in a different project directory than the lead terminal — that's what keeps the two terminals' `RELAY_NAME` values isolated.

## Step 1 — Resolve paths

Determine `HOME` (Bash: `echo $HOME`; Node: `node -e "console.log(require('os').homedir())"`). Use forward-slash form.

Detect the active Claude data dir from the `CLAUDE_CONFIG_DIR` env var (Claude Code injects this into every skill run):

```bash
CLAUDE_DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

Use forward-slash form (on Windows, convert backslashes).

Define:
- TEAM_DIR = `CLAUDE_DATA_DIR/relay/$team_name`
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

## Step 4 — Refuse to overwrite an existing lead registration

`claude mcp add` doesn't error on duplicate names — it silently overwrites. That makes it dangerous to run join in the same project directory where create was already run, because it would clobber the lead's identity. Guard against that.

Run `claude mcp get relay-$team_name 2>/dev/null` (in the current cwd). Parse the output. If a registration exists AND its `RELAY_NAME=lead`, print:

  This terminal is already registered as "lead" for relay team "$team_name"
  (project path: <CWD>). Joining as "$agent_name" here would overwrite that
  identity and break the relay team.

  Open Claude in a DIFFERENT project directory, then run:
    /relay:join $team_name $agent_name

  there. Each terminal in a relay team must be in its own project dir; that's
  how each one keeps an isolated RELAY_NAME.

And stop.

If a registration exists with a different `RELAY_NAME` (e.g. you're re-joining under a new name), proceed — the next step will remove and re-add it.

## Step 5 — Register the MCP server with `claude mcp add`

Run this command (replacing `<TEAM_DIR>` and `<SERVER_PATH>` with the resolved forward-slash paths). The `=` after each option is required — the CLI's `--env` is variadic and would otherwise eat the server name:

```
claude mcp add --transport=stdio --env=RELAY_TEAM=$team_name --env=RELAY_NAME=$agent_name --env=RELAY_ROLE=agent --env=RELAY_DIR=<TEAM_DIR> relay-$team_name -- node <SERVER_PATH>
```

If `<TEAM_DIR>` or `<SERVER_PATH>` contain spaces, wrap the whole `--env=…` token (or path arg) in double quotes.

If the command fails because `relay-$team_name` already exists in this project's local scope (you're re-joining as a different agent name — already past the lead-overwrite guard above), first run `claude mcp remove relay-$team_name` and then re-run the add command.

If `claude` is not on PATH, print the error and stop.

Print: `✓ Registered "relay-$team_name" as "$agent_name" via claude mcp add (scope=local)`.

## Step 6 — Print restart instructions

Print exactly:

Joined relay team "$team_name" as "$agent_name".

The MCP server is registered to THIS terminal's project path. It won't appear in any other project.

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude --dangerously-load-development-channels server:relay-$team_name` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.
  4. Approve the development-channel confirmation prompt when asked.

The --dangerously-load-development-channels flag enables real-time push delivery for relay — incoming messages appear in your session automatically as <channel> tags, no polling needed. Locally-defined MCP servers aren't on Claude Code's approved channels allowlist, so this flag is required. (Don't use plain --channels server:relay-$team_name — that won't bypass the allowlist and notifications will silently drop.)

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member (e.g. to="lead")
  - relay_members()           list registered members

To verify the server is registered, run: `claude mcp list`

To leave the team later:
  /relay:end $team_name
