---
name: join
description: Join an existing relay team from a second (or third, etc.) terminal. Run this AFTER the lead terminal has run /relay:create. Writes a cwd-keyed identity file at ~/.claude/relay/identities/<hash>.json so this terminal becomes addressable as <agent-name>. After it runs, the user must restart Claude Code once and choose "Resume previous conversation" to keep their context.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
allowed-tools: Bash Read Write
---

Join the relay team "$team_name" as "$agent_name".

The relay MCP server is auto-loaded from the plugin in every Claude Code session and reads its identity from a cwd-keyed file. Run this skill in a different project directory than the lead terminal — that's what gives each terminal its own identity.

## Step 1 — Resolve, check, and write everything in one shot

Run this single Node script. It computes paths, runs pre-flight checks, writes the identity file, and prints a JSON status line — all atomically inside one Node process so Windows backslash paths never get re-embedded in another command.

```bash
node -e "
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const cwd=process.cwd();
const dataDir=process.env.CLAUDE_CONFIG_DIR||path.join(os.homedir(),'.claude');
const hash=crypto.createHash('sha256').update(cwd).digest('hex').slice(0,16);
const teamName='$team_name';
const agentName='$agent_name';
const teamDir=path.join(dataDir,'relay',teamName);
const identitiesDir=path.join(dataDir,'relay','identities');
const identityFile=path.join(identitiesDir,hash+'.json');
const fwd=p=>p.split(path.sep).join('/');
const out=o=>{console.log(JSON.stringify(o));process.exit(0);};
if (!fs.existsSync(teamDir)) out({status:'team_missing',teamName,teamDir:fwd(teamDir)});
if (agentName==='lead') out({status:'reserved_name',agentName});
if (fs.existsSync(identityFile)) {
  let existing=null; try { existing=JSON.parse(fs.readFileSync(identityFile,'utf8')); } catch {}
  if (existing && existing.team===teamName && existing.name===agentName) {
    fs.writeFileSync(identityFile, JSON.stringify({team:teamName,name:agentName,role:'agent'},null,2));
    out({status:'ok_refresh',teamName,agentName,identityFile:fwd(identityFile),cwd:fwd(cwd),hash});
  }
  out({status:'identity_conflict',cwd:fwd(cwd),hash,identityFile:fwd(identityFile),existing,teamName,agentName});
}
fs.mkdirSync(identitiesDir,{recursive:true});
fs.writeFileSync(identityFile, JSON.stringify({team:teamName,name:agentName,role:'agent'},null,2));
out({status:'ok',teamName,agentName,identityFile:fwd(identityFile),cwd:fwd(cwd),hash});
"
```

The output is a single JSON line. Parse it and dispatch on `status`. **Use the JSON path fields only for printing to the user — never embed them in another `node -e` script or any other code, since Windows path separators look like JS escape sequences.**

## Step 2 — Handle the result

**If `status === 'team_missing'`**, print:

  Relay team "$team_name" not found at `<teamDir>`.
  In the lead terminal, run /relay:create $team_name. Then re-run this command here.

And stop.

**If `status === 'reserved_name'`**, print:

  The name "lead" is reserved for the terminal that ran /relay:create.
  Pick a different agent name (e.g. "agent1", "fe", "backend").

And stop.

**If `status === 'identity_conflict'`**, print:

  This terminal (cwd: `<cwd>`) already has a relay identity for cwd-hash `<hash>`:
    team=`<existing.team>`, name=`<existing.name>`
  Joining as "$agent_name" here would overwrite it.

  Open Claude in a DIFFERENT project directory and run:
    /relay:join $team_name $agent_name
  there.

  Or, to RENAME this terminal in place, run /relay:end <existing.team> first, then re-run /relay:join.

And stop. Each terminal in a relay team must be in its own project dir; that's how each one keeps an isolated identity.

**If `status === 'ok'` or `status === 'ok_refresh'`**, continue to Step 3. (`ok_refresh` means the same identity was rewritten with no change — fine to proceed.)

## Step 3 — Print success and restart instructions

Print exactly:

  ✓ Wrote identity file at `<identityFile>`

  Joined relay team "$team_name" as "$agent_name".

  Identity file: `<identityFile>`

  The relay MCP server is declared in the plugin and auto-loads in every Claude Code session. The server reads this identity file at startup based on your cwd.

  Next steps in THIS terminal:
    1. Quit Claude Code (Ctrl+D or close).
    2. Re-run `claude --dangerously-load-development-channels plugin:relay@vibe-plugins` in the same directory.
    3. When prompted, choose "Resume previous conversation" — your context is preserved.
    4. Approve the development-channel confirmation prompt when asked.

  The --dangerously-load-development-channels flag enables real-time push delivery — incoming messages appear in your session as <channel> tags automatically.

  Once restarted you'll have these MCP tools:
    - relay_send(to, message)   send a message to another member (e.g. to="lead")
    - relay_members()           list registered members

  To leave the team later:
    /relay:end $team_name
