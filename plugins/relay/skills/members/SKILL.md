---
name: members
description: List all members currently registered in the relay team for this terminal. Thin wrapper around the relay_members MCP tool — type /relay:members instead of asking Claude to call relay_members(). Only works if relay-<team> MCP server is connected (run /relay:create or /relay:join first and restart Claude).
allowed-tools: mcp__*__relay_members
---

Call the `relay_members` tool from the connected `relay-*` MCP server and print its output verbatim.

If multiple `relay-*` servers are connected (you joined multiple teams), call each one and label the output by team. If none are connected, print:

  No relay team is connected in this terminal. Run /relay:create <team> or /relay:join <team> <name>, then restart Claude with `claude --dangerously-load-development-channels server:relay-<team>`.
