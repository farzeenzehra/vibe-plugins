---
name: send
description: Send a message to another member of the relay team. Thin wrapper around the relay_send MCP tool — type /relay:send <to> <message...> instead of asking Claude to call relay_send(). The recipient sees the message as a <channel> notification automatically (no relay_receive needed on their end). Only works if relay-<team> MCP server is connected.
argument-hint: <to> <message...>
arguments: [to, message]
allowed-tools: mcp__*__relay_send
---

Call the `relay_send` tool from the connected `relay-*` MCP server with `to="$to"` and `message="$message"`, then print the tool's result.

If no `relay-*` server is connected, print:

  No relay team is connected in this terminal. Run /relay:create <team> or /relay:join <team> <name> first, then restart Claude with `claude --dangerously-load-development-channels plugin:relay@vibe-plugins`.

If multiple `relay-*` servers are connected and the recipient is ambiguous, ask the user which team to send through before calling.
