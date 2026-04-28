---
name: create
description: Create a relay team in the lead terminal. Use whenever the user wants two or more Claude Code terminals to message each other while keeping their existing conversation context (unlike /squad:add-agent which starts a fresh agent session). Writes a cwd-keyed identity file at ~/.claude/relay/identities/<hash>.json and the shared team directory at ~/.claude/relay/<team-name>/. After it runs, the user must restart Claude Code once and choose "Resume previous conversation".
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

Set up a relay team named "$team_name" rooted in this terminal as the lead.

The relay MCP server is auto-loaded from the plugin's bundled `.mcp.json` in every Claude Code session. It looks up an identity file keyed by the session's current working directory; when found, it joins that team. This skill writes that identity file plus the shared team directory.

## Step 1 — Resolve, check, and create everything in one shot

Run this single Node script. It computes paths, runs pre-flight checks, creates the team directory, writes the identity file, and prints a JSON status line — all atomically inside one Node process so Windows backslash paths never get re-embedded in another command.

```bash
node -e "
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const cwd=process.cwd();
const dataDir=process.env.CLAUDE_CONFIG_DIR;
const hash=crypto.createHash('sha256').update(cwd).digest('hex').slice(0,16);
const teamName='$team_name';
const fwd=p=>p.split(path.sep).join('/');
const out=o=>{console.log(JSON.stringify(o));process.exit(0);};
if (!dataDir) out({status:'no_config_dir'});
const teamDir=path.join(dataDir,'relay',teamName);
const identitiesDir=path.join(dataDir,'relay','identities');
const identityFile=path.join(identitiesDir,hash+'.json');
if (fs.existsSync(teamDir)) out({status:'team_exists',teamName,teamDir:fwd(teamDir)});
if (fs.existsSync(identityFile)) {
  let existing=null; try { existing=JSON.parse(fs.readFileSync(identityFile,'utf8')); } catch {}
  out({status:'identity_exists',cwd:fwd(cwd),hash,identityFile:fwd(identityFile),existing});
}
fs.mkdirSync(teamDir,{recursive:true});
fs.mkdirSync(identitiesDir,{recursive:true});
fs.writeFileSync(identityFile, JSON.stringify({team:teamName,name:'lead',role:'lead'},null,2));
out({status:'ok',teamName,teamDir:fwd(teamDir),identityFile:fwd(identityFile),cwd:fwd(cwd),hash});
"
```

The output is a single JSON line. Parse it and dispatch on `status`. **Use the JSON path fields only for printing to the user — never embed them in another `node -e` script or any other code, since Windows path separators look like JS escape sequences.**

## Step 2 — Handle the result

**If `status === 'no_config_dir'`**, print:

  CLAUDE_CONFIG_DIR is not set. This skill must be run inside a Claude Code session.

And stop.

**If `status === 'team_exists'`**, print:

  Relay team "$team_name" already exists at `<teamDir>`.
  To rebuild it from scratch, run /relay:end $team_name in any terminal that joined, then re-run this command.

And stop.

**If `status === 'identity_exists'`**, print:

  This terminal (cwd: `<cwd>`) already has a relay identity for cwd-hash `<hash>`.
  Existing identity: team=`<existing.team>`, name=`<existing.name>` (at `<identityFile>`).
  Run /relay:end <existing.team> first, or open Claude in a different project directory.

And stop.

**If `status === 'ok'`**, continue to Step 3.

## Step 3 — Print success and restart instructions

Print exactly:

  ✓ Wrote identity file at `<identityFile>`
  ✓ Created team dir at `<teamDir>`

  Relay team "$team_name" is set up. This terminal is registered as "lead".

  Identity file: `<identityFile>`
  Team dir:     `<teamDir>`

  The relay MCP server is declared in the plugin and auto-loads in every Claude Code session. The server reads this identity file at startup based on your cwd.

  Next steps in THIS terminal:
    1. Quit Claude Code (Ctrl+D or close).
    2. Re-run `claude --dangerously-load-development-channels plugin:relay@vibe-plugins` in the same directory.
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
