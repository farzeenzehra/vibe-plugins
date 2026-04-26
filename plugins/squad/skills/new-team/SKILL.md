---
name: new-team
description: Create a squad agent team. Ensures CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is enabled in settings, then creates the team. Run this once before connecting agents with /squad:add-agent.
argument-hint: <team-name>
arguments: [team_name]
disable-model-invocation: true
allowed-tools: Read Write TeamCreate
---

Create a new squad team named "$team_name".

## Step 1 — Enable agent teams in settings

Read `~/.claude/settings.json`. If the file does not exist, treat its contents as `{}`.

Check if `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` equals `"1"`:
- If the `env` key does not exist: create it, add `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` with value `"1"` under it, and write the updated JSON back to the file.
- If the `env` key exists but `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is not set or not `"1"`: add or update the value and write the file.
- If already set to `"1"`: no change needed.

In all cases print the result: either `✓ Enabled CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS in ~/.claude/settings.json` or `✓ Already enabled`.

## Step 2 — Create the team

Call TeamCreate with team name `$team_name`.

Extract `leadSessionId` from the response.

## Step 3 — Print summary

Print the following as plain text (replace LEAD_SESSION_ID with the actual value from step 2):

Squad "$team_name" ready.
Lead session: LEAD_SESSION_ID

To generate the join command for an agent, run in this terminal:
  /squad:add-agent <agent-name>
