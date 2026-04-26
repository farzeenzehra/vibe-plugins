---
name: end-team
description: Delete an existing squad team. Run this before creating a new team if you are already leading one.
argument-hint: <team-name>
arguments: [team_name]
disable-model-invocation: true
allowed-tools: TeamDelete
---

End the squad team named "$team_name".

## Steps

1. Call TeamDelete with team name `$team_name`.

2. Print the following as plain text:

Squad "$team_name" ended.

You can now create a new team with:
  /squad:new-team <team-name>
