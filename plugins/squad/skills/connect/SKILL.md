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
   - If the file does not exist, print: Team "$team_name" not found. Run /squad:new-team $team_name first. Then stop.

2. Extract the value of `leadSessionId` from the config. Call it LEAD_SESSION_ID for the output below.

3. Print the following as plain text, replacing every occurrence of LEAD_SESSION_ID with the actual value extracted in step 2, and replacing AGENT_NAME with $agent_name and TEAM_NAME with $team_name:

Agent: AGENT_NAME
Team:  TEAM_NAME
Lead session: LEAD_SESSION_ID

Open a new terminal in your target project directory and paste one of the commands below:

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

After running, type this in the agent terminal to activate the channel:
  check your inbox from team-lead
