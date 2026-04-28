---
name: end
description: End a relay team in this terminal. Deletes this terminal's cwd-keyed identity file at ~/.claude/relay/identities/<hash>.json, and (if no other identity files reference the team) deletes the shared ~/.claude/relay/<team-name>/ directory. Run in every terminal that joined to fully clean up. Use when the relay session is done, before re-creating a team with the same name, or to recover from a broken state.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

End the relay team named "$team_name" in this terminal.

## Step 1 — Resolve paths

```bash
node -e "
const os=require('os'),path=require('path'),crypto=require('crypto');
const home=os.homedir().replace(/\\\\/g,'/');
const dataDir=(process.env.CLAUDE_CONFIG_DIR||(home+'/.claude')).replace(/\\\\/g,'/');
const hash=crypto.createHash('sha256').update(process.cwd()).digest('hex').slice(0,16);
console.log(JSON.stringify({dataDir,hash,
  teamDir:dataDir+'/relay/$team_name',
  identitiesDir:dataDir+'/relay/identities',
  identityFile:dataDir+'/relay/identities/'+hash+'.json'}));"
```

Capture `teamDir`, `identitiesDir`, `identityFile`.

## Step 2 — Delete this terminal's identity file

If `identityFile` exists, read it first to confirm it actually references `$team_name`:

- If its `team` matches `$team_name`, delete the file. Print: `✓ Removed identity file <identityFile>`.
- If its `team` does not match (e.g., this cwd is in a different team), print: `(this terminal's identity references team "<other>", not "$team_name" — leaving it alone)` and skip to Step 3.

If `identityFile` does not exist, print: `(this terminal had no identity for "$team_name" — already removed or never joined)`.

## Step 3 — Decide whether to delete the shared team directory

Scan `identitiesDir` for any remaining files that reference this team:

```bash
node -e "
const fs=require('fs'),path=require('path');
const dir='<identitiesDir>';
let inUse=false;
try {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
      if (j.team==='$team_name') { inUse=true; break; }
    } catch {}
  }
} catch {}
console.log(inUse?'inuse':'free');"
```

- If `free` and `teamDir` exists, delete `teamDir` recursively (`rm -rf "<teamDir>"`). Print: `✓ Deleted shared team dir <teamDir>`.
- If `inuse`, print: `(other terminals are still in this team — leaving <teamDir> in place)`.
- If `teamDir` doesn't exist, print: `(team directory was already gone)`.

## Step 4 — Print restart hint

Print exactly:

Relay team "$team_name" cleaned up in this terminal.

To fully unload the MCP server's awareness, restart Claude Code (resume the conversation if you want to keep context) — though the plugin-declared server will still load in the new session, it'll have no identity here and serve no relay tools.

Other terminals that joined this team should also run:
  /relay:end $team_name
…in their own project directories — each one needs to remove its own identity file.
