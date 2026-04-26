---
name: end-team
description: Delete an existing squad team. Use this when the user wants to start a new team, clean up after a session, or gets an error saying they are already leading a team.
argument-hint: <team-name>
arguments: [team_name]
disable-model-invocation: true
allowed-tools: Read TeamDelete
---

End the squad team named "$team_name".

## Steps

1. Call TeamDelete with team name `$team_name`.
   - If the team does not exist, print: `Team "$team_name" not found.` and stop.

2. Print the following as plain text:

Squad "$team_name" ended.

You can now create a new team with:
  /squad:new-team <team-name>
