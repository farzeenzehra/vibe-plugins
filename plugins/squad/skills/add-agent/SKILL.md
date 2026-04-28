---
name: add-agent
description: Generate the join command for an agent to connect to the current squad team. Run from the lead terminal after /squad:new-team. Outputs ready-to-paste commands in Bash, PowerShell, and CMD. Use this whenever you need to bring a teammate from another project terminal into the current team, or when the user asks "how do I connect from another terminal?" or "add another Claude agent to this session".
argument-hint: <agent-name>
arguments: [agent_name]
allowed-tools: Read
---

Generate the join command for "$agent_name" to join the current squad team.

## Steps

1. Find the current team by reading the `~/.claude/teams/` directory.
   - List all subdirectories — each is a team name.
   - If none exist: print `No active team found. Run /squad:new-team <team-name> first.` and stop.
   - If exactly one exists: use it.
   - If multiple exist: pick the most recently modified config file.
   - Read `~/.claude/teams/<team-name>/config.json` and extract `leadSessionId` and the team name. Refer to these as LEAD_SESSION_ID and TEAM_NAME below.

2. Print the following as plain text, replacing AGENT_NAME with $agent_name, TEAM_NAME and LEAD_SESSION_ID with the values from step 1:

Agent: AGENT_NAME
Team:  TEAM_NAME
Lead session: LEAD_SESSION_ID

Open a new terminal in your target project directory and paste one of:

Bash / WSL / Git Bash:

  CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
    --agent-id "AGENT_NAME@TEAM_NAME" \
    --agent-name "AGENT_NAME" \
    --team-name "TEAM_NAME" \
    --parent-session-id "LEAD_SESSION_ID"

PowerShell:

  $env:CLAUDECODE="1"; $env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"; claude `
    --agent-id "AGENT_NAME@TEAM_NAME" `
    --agent-name "AGENT_NAME" `
    --team-name "TEAM_NAME" `
    --parent-session-id "LEAD_SESSION_ID"

CMD:

  set CLAUDECODE=1 && set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude ^
    --agent-id "AGENT_NAME@TEAM_NAME" ^
    --agent-name "AGENT_NAME" ^
    --team-name "TEAM_NAME" ^
    --parent-session-id "LEAD_SESSION_ID"

Once the agent is running, send it a task from this terminal using SendMessage.
