---
name: new-team
description: Create a squad agent team. Use this whenever the user wants to start a multi-terminal or cross-project Claude session, coordinate agents across projects, or set up a team. Ensures CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is enabled in settings then creates the team. Always run this before /squad:add-agent.
argument-hint: <team-name>
arguments: [team_name]
disable-model-invocation: true
allowed-tools: Read Write TeamCreate
---

Create a new squad team named "$team_name".

## Step 1 — Enable agent teams in settings

Read `~/.claude/settings.json`. If the file does not exist, treat its contents as `{}`.

Check if `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` equals `"1"`. If not, update the file — creating the `env` key if it doesn't exist — and set the value to `"1"`. Write the result back as valid JSON.

Print: `✓ Enabled CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` or `✓ Already enabled`.

## Step 2 — Create the team

Call TeamCreate with team name `$team_name`.

Extract `leadSessionId` from the response.

## Step 3 — Print summary

Print the following as plain text (replace LEAD_SESSION_ID with the actual value from step 2):

Squad "$team_name" ready.
Lead session: LEAD_SESSION_ID

To generate the join command for an agent, run in this terminal:
  /squad:add-agent <agent-name>
