---
name: new-team
description: Create a squad agent team. Ensures CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is enabled in settings, then creates the team. Run this once before connecting agents with /squad:connect.
argument-hint: <team-name>
arguments: [team_name]
disable-model-invocation: true
allowed-tools: Read Write TeamCreate
---

Create a new squad team named "$team_name".

## Step 1 — Enable agent teams in settings

Read `~/.claude/settings.json`. If the file does not exist, treat its contents as `{}`.

Check if `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` equals `"1"`:
- If not set: add it under the `env` key and write the updated JSON back to the file. Print `✓ Enabled CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS in ~/.claude/settings.json`
- If already set: print `✓ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS already enabled`

## Step 2 — Create the team

Call TeamCreate with team name `$team_name`.

Extract `leadSessionId` from the response.

## Step 3 — Print summary

Print exactly this (fill in all values):

```
Squad "$team_name" ready.
Lead session: <leadSessionId>

To connect an agent from another terminal, run from this session:
  /squad:connect $team_name <agent-name>
```
