---
name: create
description: Create a relay team in the lead terminal. Use whenever the user wants two or more Claude Code terminals to message each other while keeping their existing conversation context (unlike /squad:add-agent which starts a fresh agent session). Writes a cwd-keyed identity file at ~/.claude/relay/identities/<hash>.json and the shared team directory at ~/.claude/relay/<team-name>/. The MCP server is auto-loaded from the plugin in every session, so no claude mcp add is needed. After it runs, the user must restart Claude Code once and choose "Resume previous conversation".
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

Set up a relay team named "$team_name" rooted in this terminal as the lead.

The relay MCP server is auto-loaded from the plugin's bundled `.mcp.json` in every Claude Code session. It looks up an identity file keyed by the session's current working directory; when found, it joins that team. This skill writes that identity file plus the shared team directory.

## Step 1 — Resolve paths

Run this Node one-liner to compute everything in one shot (forward-slash form, cwd hash, all derived paths):

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

Capture `teamDir`, `identitiesDir`, `identityFile`, `hash`, `cwd` from the JSON output (paths are native to the OS — Windows backslashes are fine to use directly).

## Step 2 — Refuse if the team or identity already exist

If `teamDir` exists, print:

  Relay team "$team_name" already exists at <teamDir>.
  To rebuild it from scratch, run /relay:end $team_name in any terminal that joined, then re-run this command.

And stop.

If `identityFile` exists, print:

  This terminal (cwd: <cwd>) already has a relay identity for cwd-hash <hash>.
  Run /relay:end <existing-team> first, or open Claude in a different project directory.

And stop.

## Step 3 — Write the team directory and the identity file

Create `teamDir` (recursively).

Write `identityFile` with this exact JSON content (replace `$team_name`):

```json
{
  "team": "$team_name",
  "name": "lead",
  "role": "lead"
}
```

Use Bash `mkdir -p` and a Node `fs.writeFileSync` (or `cat <<EOF`) to create both. The identity file's parent dir (`<dataDir>/relay/identities/`) may not exist yet — create it first.

Print: `✓ Wrote identity file at <identityFile>` and `✓ Created team dir at <teamDir>`.

## Step 4 — Print restart instructions

Print exactly:

Relay team "$team_name" is set up. This terminal is registered as "lead".

Identity file: <identityFile>
Team dir:     <teamDir>

The relay MCP server is declared in the plugin and auto-loads in every Claude Code session — no `claude mcp add` needed. The server reads this identity file at startup based on your cwd.

Next steps in THIS terminal:
  1. Quit Claude Code (Ctrl+D or close).
  2. Re-run `claude --dangerously-load-development-channels server:relay` in the same directory.
  3. When prompted, choose "Resume previous conversation" — your context is preserved.
  4. Approve the development-channel confirmation prompt when asked.

The --dangerously-load-development-channels flag enables real-time push delivery — incoming messages appear in your session as <channel> tags automatically. The plugin's MCP server isn't on Claude Code's approved channels allowlist, so this flag is required.

Once restarted you'll have these MCP tools:
  - relay_send(to, message)   send a message to another member
  - relay_members()           list registered members

To bring another terminal into this team, in that terminal's project directory run:
  /relay:join $team_name <agent-name>

To clean up later (run in each terminal that joined):
  /relay:end $team_name
