---
name: end
description: End a relay team in this terminal. Deletes this terminal's cwd-keyed identity file at ~/.claude/relay/identities/<hash>.json, and (if no other identity files reference the team) deletes the shared ~/.claude/relay/<team-name>/ directory. Run in every terminal that joined to fully clean up. Use when the relay session is done, before re-creating a team with the same name, or to recover from a broken state.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

End the relay team named "$team_name" in this terminal.

## Step 1 — Resolve, check, and clean up everything in one shot

Run this single Node script. It computes paths, removes the identity file (if it matches this team), scans remaining identities, deletes the shared team dir if no one else references it, and prints a JSON status line — all atomically inside one Node process so Windows backslash paths never get re-embedded in another command.

```bash
node -e "
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const home=os.homedir();
const cwd=process.cwd();
const dataDir=process.env.CLAUDE_CONFIG_DIR||path.join(home,'.claude');
const hash=crypto.createHash('sha256').update(cwd).digest('hex').slice(0,16);
const teamName='$team_name';
const teamDir=path.join(dataDir,'relay',teamName);
const identitiesDir=path.join(dataDir,'relay','identities');
const identityFile=path.join(identitiesDir,hash+'.json');
const fwd=p=>p.split(path.sep).join('/');
const r={teamName,teamDir:fwd(teamDir),identitiesDir:fwd(identitiesDir),identityFile:fwd(identityFile),hash,cwd:fwd(cwd)};
r.identityAction='none';
if (fs.existsSync(identityFile)) {
  let j=null; try { j=JSON.parse(fs.readFileSync(identityFile,'utf8')); } catch {}
  if (j && j.team===teamName) { fs.unlinkSync(identityFile); r.identityAction='removed'; }
  else if (j) { r.identityAction='mismatch'; r.otherTeam=j.team||'(unknown)'; }
  else { fs.unlinkSync(identityFile); r.identityAction='removed_corrupt'; }
} else {
  r.identityAction='missing';
}
let inUse=false;
if (fs.existsSync(identitiesDir)) {
  for (const f of fs.readdirSync(identitiesDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const j=JSON.parse(fs.readFileSync(path.join(identitiesDir,f),'utf8'));
      if (j.team===teamName) { inUse=true; break; }
    } catch {}
  }
}
r.inUse=inUse;
r.teamDirAction='none';
if (!inUse) {
  if (fs.existsSync(teamDir)) { fs.rmSync(teamDir,{recursive:true,force:true}); r.teamDirAction='removed'; }
  else { r.teamDirAction='missing'; }
} else {
  r.teamDirAction='kept_in_use';
}
console.log(JSON.stringify(r));
"
```

The output is a single JSON line. Parse it. **Use the JSON path fields only for printing to the user — never embed them in another `node -e` script or any other code, since Windows path separators look like JS escape sequences.**

## Step 2 — Print results

Based on `identityAction`:
- `removed` or `removed_corrupt`: print `✓ Removed identity file <identityFile>`.
- `mismatch`: print `(this terminal's identity references team "<otherTeam>", not "$team_name" — leaving it alone)`.
- `missing`: print `(this terminal had no identity for "$team_name" — already removed or never joined)`.

Based on `teamDirAction`:
- `removed`: print `✓ Deleted shared team dir <teamDir>`.
- `kept_in_use`: print `(other terminals are still in this team — leaving <teamDir> in place)`.
- `missing`: print `(team directory was already gone)`.
- `none`: skip (only happens when identityAction was `mismatch` and we still scanned but action wasn't taken — print nothing extra).

## Step 3 — Print restart hint

Print exactly:

  Relay team "$team_name" cleaned up in this terminal.

  To fully unload the MCP server's awareness, restart Claude Code (resume the conversation if you want to keep context) — though the plugin-declared server will still load in the new session, it'll have no identity here and serve no relay tools.

  Other terminals that joined this team should also run:
    /relay:end $team_name
  …in their own project directories — each one needs to remove its own identity file.
