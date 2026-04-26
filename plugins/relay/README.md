# relay

Cross-terminal Claude Code messaging via MCP — **without losing your conversation context**, and with **real-time push delivery** (no polling required).

Where `/squad:add-agent` requires the second terminal to start a fresh session, relay only asks each terminal to restart once and resume its previous conversation. After that, both terminals share MCP tools for messaging, and incoming messages appear automatically as `<channel>` notifications via Claude Code Channels — no manual polling.

## Skills

**Setup / teardown:**

| Skill | Description |
|---|---|
| `/relay:create <team-name>` | Set up a relay team in the lead terminal (copies the zero-dep server, registers MCP) |
| `/relay:join <team-name> <agent-name>` | Join an existing relay from another terminal |
| `/relay:end <team-name>` | Remove the MCP server from settings and delete the team directory |

**Day-to-day messaging** (thin slash wrappers around the MCP tools — type these instead of asking Claude to call the underlying tool):

| Skill | Description |
|---|---|
| `/relay:send <to> <message>` | Send a message to another team member (they see it auto as a `<channel>` notification) |
| `/relay:members` | List who's connected |
| `/relay:receive` | Manually flush your inbox (rarely needed — channel push delivers automatically) |

## How it works

- Each terminal runs its own Node.js subprocess as a stdio MCP server (no HTTP, no port management).
- All subprocesses share state via JSON files in a shared `<CLAUDE_CONFIG_DIR>/relay/<team-name>/` directory (auto-detected from the active Claude Code data dir).
- The MCP server is registered via **`claude mcp add --scope local`** (Claude Code's default scope). That CLI writes to `~/.claude.json` *under the current project's path entry* — so two terminals in different project directories get isolated configs and isolated `RELAY_NAME` values, without committing anything to either project repo.
- The server declares the `claude/channel` capability and uses `fs.watchFile` (200ms polling) to detect inbox changes, then pushes a `notifications/claude/channel` event to Claude Code. The recipient sees the message **immediately** as a `<channel>` notification.
- Adding an MCP server requires one Claude Code restart per terminal — but the conversation history is preserved when you choose "Resume previous conversation".

## Usage

> **Note:** each terminal must be open in a *different* project directory. Relay registers the MCP server scoped to the current project path; same path → shared identity.

**Step 1 — In your lead terminal (open in some project, e.g. `~/projects/backend`):**
```
/relay:create my-team
```
Sets up the shared `~/.claude/relay/my-team/`, runs `npm install`, and registers the MCP server via `claude mcp add` as `relay-my-team` with `RELAY_NAME=lead`, scoped to this terminal's project path.

**Step 2 — Restart Claude Code in this terminal** with the channel-enabled flag:
```
claude --dangerously-load-development-channels server:relay-my-team
```
Approve the channel confirmation prompt. Choose "Resume previous conversation" when prompted.

**Step 3 — In another terminal, opened in a DIFFERENT project (e.g. `~/projects/frontend`):**
```
/relay:join my-team agent1
```
Registers `relay-my-team` with `RELAY_NAME=agent1` scoped to *that* terminal's project path. Then restart with:
```
claude --dangerously-load-development-channels server:relay-my-team
```
Approve the prompt, resume previous conversation.

You can verify either registration with `claude mcp list`.

**Step 4 — Once both terminals are restarted, message back and forth:**
```
relay_members()                                      # see who's connected
relay_send(to="agent1", message="please look at X")  # from lead → agent1
```
Agent1's session sees a `<channel source="relay-my-team" from="lead">please look at X</channel>` notification appear automatically — no `relay_receive` call needed.

**Cleanup:**
```
/relay:end my-team
```
Run in each terminal that joined.

## MCP tools provided after restart

| Tool | Description |
|---|---|
| `relay_send(to, message)` | Push a message to another member — they see it as a `<channel>` notification automatically |
| `relay_receive()` | Manually read and clear your own inbox (rarely needed since channels push automatically) |
| `relay_members()` | List all registered members |

## Requirements

- Node.js on PATH (the server is **zero-dependency** — pure Node.js stdio JSON-RPC, no `npm install` required)
- `claude` (the Claude Code CLI) on PATH — used to register/deregister the MCP server
- All terminals on the same machine (shared filesystem at `~/.claude/relay/`)
- Each terminal opened in a **different project directory** — local-scope MCP servers are keyed by project path, so two terminals in the same directory share one identity

## Limitations

- **One restart per terminal** — unavoidable for MCP server activation. Conversation context survives via "Resume previous conversation".
- **Requires `--dangerously-load-development-channels`** during the channels research preview — relay isn't on Anthropic's approved channel allowlist yet. The flag prompts for confirmation at startup; approve once and the channel is active for that session. (Team/Enterprise admins can pre-approve relay via managed settings' `allowedChannelPlugins` to skip the flag.)
- **Channels require claude.ai login** — API key auth is not supported for channels.

## Installation

```
/plugin marketplace add farzeenzehra/vibe-plugins
/plugin install relay@vibe-plugins
```

## Updating

Refresh the marketplace catalog and reinstall:

```
/plugin marketplace update vibe-plugins
/plugin install relay@vibe-plugins
```

(You can also use the interactive `/plugin` UI — it'll show available updates.)

### Important: existing relay teams don't auto-upgrade

When `/relay:create <team>` runs, it **copies** `server.js` and `package.json` into `~/.claude/relay/<team>/` and runs `npm install` there. That copy is frozen at the version you had when the team was created — installing a newer plugin does **not** update an already-running team.

To pick up server changes for an active team, in **every** terminal that joined:

```
/relay:end <team>
```

…then have the lead recreate it and the others rejoin:

```
# lead terminal
/relay:create <team>

# each agent terminal
/relay:join <team> <agent-name>
```

(Restart Claude Code in each terminal afterward, same as the first time.)

If you only changed the skills (`SKILL.md` files) and not `server.js`, you don't need to recreate teams — skill changes take effect on next invocation.

