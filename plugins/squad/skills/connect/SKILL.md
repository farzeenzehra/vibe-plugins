---
name: connect
description: Print the join command for an agent to connect to a squad team. Run from the lead terminal after /squad:new-team. Outputs ready-to-paste commands in Bash, PowerShell, and CMD formats.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
disable-model-invocation: true
allowed-tools: Read
---

Generate the join command for agent "$agent_name" to connect to team "$team_name".

## Steps

1. Read `~/.claude/teams/$team_name/config.json`.
   - If the file does not exist, print: `Team "$team_name" not found. Run /squad:new-team $team_name first.` and stop.

2. Extract the value of `leadSessionId` from the config.

3. Print the following exactly, substituting all placeholder values:

---
**Agent:** `$agent_name`  
**Team:** `$team_name`  
**Lead session:** `<leadSessionId>`

Open a new terminal in your target project directory and paste one of:

**Bash / WSL / Git Bash**
```bash
CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
  --agent-id "$agent_name@$team_name" \
  --agent-name "$agent_name" \
  --team-name "$team_name" \
  --parent-session-id "<leadSessionId>"
```

**PowerShell**
```powershell
$env:CLAUDECODE=1; $env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; claude `
  --agent-id "$agent_name@$team_name" `
  --agent-name "$agent_name" `
  --team-name "$team_name" `
  --parent-session-id "<leadSessionId>"
```

**CMD**
```cmd
set CLAUDECODE=1 && set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude ^
  --agent-id "$agent_name@$team_name" ^
  --agent-name "$agent_name" ^
  --team-name "$team_name" ^
  --parent-session-id "<leadSessionId>"
```

After running, type `check your inbox from team-lead` in the agent terminal to activate the channel.

---
