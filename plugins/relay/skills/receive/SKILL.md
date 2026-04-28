---
name: receive
description: Manually read and clear your inbox in the relay team. Thin wrapper around the relay_receive MCP tool — rarely needed since channel push delivers messages automatically as <channel> notifications. Use this only if you want to flush your inbox manually (e.g., if you started Claude without --dangerously-load-development-channels and channels aren't pushing). Only works if relay-<team> MCP server is connected.
allowed-tools: mcp__*__relay_receive
---

Call the `relay_receive` tool from the connected `relay-*` MCP server and print the tool's output verbatim.

If no `relay-*` server is connected, print:

  No relay team is connected in this terminal. Run /relay:create <team> or /relay:join <team> <name> first, then restart Claude.

Note: with channels active (`--dangerously-load-development-channels plugin:relay@vibe-plugins` at startup), incoming messages already arrive as `<channel>` notifications — you don't need to call this. Only useful for manual inbox flushing or sessions started without the channels flag.
