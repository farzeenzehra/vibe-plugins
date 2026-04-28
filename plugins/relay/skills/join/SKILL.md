---
name: join
description: Join an existing relay team from a second (or third, etc.) terminal. Run this AFTER the lead terminal has run /relay:create. Writes a cwd-keyed identity file at ~/.claude/relay/identities/<hash>.json so this terminal becomes addressable as <agent-name>. After it runs, the user must restart Claude Code once and choose "Resume previous conversation" to keep their context.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
allowed-tools: Bash Read Write
---

Join the relay team "$team_name" as "$agent_name".

The relay MCP server is auto-loaded from the plugin in every Claude Code session and reads its identity from a cwd-keyed file. Run this skill in a different project directory than the lead terminal — that's what gives each terminal its own identity.

## Step 1 — Resolve paths

```bash
node -e "
const os=require('os'),path=require('path'),crypto=require('crypto');
const home=os.homedir();
const cwd=process.cwd();
const dataDir=process.env.CLAUDE_CONFIG_DIR||path.join(home,'.claude');
const hash=crypto.createHash('sha256').update(cwd).digest('hex').slice(0,16);
console.log(JSON.stringify({home,cwd,dataDir,hash,
  teamDir:path.join(dataDir,'relay','$team_name'),
  identitiesDir:path.join(dataDir,'relay','identities'),
  identityFile:path.join(dataDir,'relay','identities',hash+'.json')}));"
```

Capture `teamDir`, `identityFile`, `hash`, `cwd` from the JSON output (paths are native to the OS — Windows backslashes are fine to use directly).

## Step 2 — Verify the team exists

If `teamDir` does not exist, print:

  Relay team "$team_name" not found at <teamDir>.
  In the lead terminal, run /relay:create $team_name. Then re-run this command here.

And stop.

## Step 3 — Sanity check the agent name

If `$agent_name` is `"lead"`, print:

  The name "lead" is reserved for the terminal that ran /relay:create.
  Pick a different agent name (e.g. "agent1", "fe", "backend").

And stop.

## Step 4 — Refuse to overwrite an existing identity

If `identityFile` exists, read it and check its `team`/`name`:

- If existing `name == "$agent_name"` AND `team == "$team_name"` (re-running join in the same dir under the same identity), proceed — Step 5 just refreshes the file.
- Otherwise print:

  This terminal (cwd: <cwd>) already has a relay identity for cwd-hash <hash>:
    team=<existing.team>, name=<existing.name>
  Joining as "$agent_name" here would overwrite it.

  Open Claude in a DIFFERENT project directory and run:
    /relay:join $team_name $agent_name
  there.

  Or, to RENAME this terminal in place, run /relay:end <existing.team> first, then re-run /relay:join.

And stop.

Each terminal in a relay team must be in its own project dir; that's how each one keeps an isolated identity.

## Step 5 — Write the identity file

Ensure `<dataDir>/relay/identities/` exists, then write `identityFile` with this exact JSON (replace placeholders):

```json
{
  "team": "$team_name",
  "name": "$agent_name",
  "role": "agent"
}
```

Print: `✓ Wrote identity file at <identityFile>`.

## Step 6 — Print restart instructions

Print exactly:

Joined relay team "$team_name" as "$agent_name".

Identity file: <identityFile>

The relay MCP server is declared in the plugin and auto-loads in every Claude Code session — no `claude mcp add` needed. The server reads this identity file at startup based on your cwd.

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude --dangerously-load-development-channels server:relay` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.
  4. Approve the development-channel confirmation prompt when asked.

The --dangerously-load-development-channels flag enables real-time push delivery — incoming messages appear in your session as <channel> tags automatically.

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member (e.g. to="lead")
  - relay_members()           list registered members

To leave the team later:
  /relay:end $team_name
