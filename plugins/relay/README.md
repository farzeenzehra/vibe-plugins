# relay

Cross-terminal Claude Code messaging via MCP — **without losing your conversation context**.

Where `/squad:add-agent` requires the second terminal to start a fresh session, relay only asks each terminal to restart once and resume its previous conversation. After that, both terminals share three MCP tools for messaging.

## Skills

| Skill | Description |
|---|---|
| `/relay:create <team-name>` | Set up a relay team in the lead terminal (writes server, runs `npm install`, registers MCP) |
| `/relay:join <team-name> <agent-name>` | Join an existing relay from another terminal |
| `/relay:end <team-name>` | Remove the MCP server from settings and delete the team directory |

## How it works

- Each terminal runs its own Node.js subprocess as a stdio MCP server (no HTTP, no port management).
- All subprocesses share state via JSON files in a shared `~/.claude/relay/<team-name>/` directory.
- The MCP server registration is **project-local** — it goes in `<cwd>/.claude/settings.local.json`, not user-global `~/.claude/settings.json`. Each terminal must therefore be in a different project directory; that's how each one gets its own `RELAY_NAME` (`lead`, `agent1`, etc.) without trampling the others.
- Adding an MCP server requires one Claude Code restart per terminal — but the conversation history is preserved when you choose "Resume previous conversation".

## Usage

> **Note:** each terminal must be open in a *different* project directory. Relay uses project-local settings to keep each terminal's identity isolated.

**Step 1 — In your lead terminal (open in some project, e.g. `~/projects/backend`):**
```
/relay:create my-team
```
Sets up the shared `~/.claude/relay/my-team/`, runs `npm install`, and registers the MCP server in `<cwd>/.claude/settings.local.json` as `relay-my-team` with `RELAY_NAME=lead`.

**Step 2 — Restart Claude Code in this terminal.** Choose "Resume previous conversation" when prompted.

**Step 3 — In another terminal, opened in a DIFFERENT project (e.g. `~/projects/frontend`):**
```
/relay:join my-team agent1
```
This writes a separate `<cwd>/.claude/settings.local.json` in *that* project with `RELAY_NAME=agent1`. Restart Claude Code. Resume previous conversation.

**Step 4 — Once both terminals are restarted, message back and forth:**
```
relay_members()                                      # see who's connected
relay_send(to="agent1", message="please look at X")  # from lead → agent1
relay_receive()                                      # agent1 reads its inbox
```

**Cleanup:**
```
/relay:end my-team
```
Run in each terminal that joined.

## MCP tools provided after restart

| Tool | Description |
|---|---|
| `relay_send(to, message)` | Write a message to another member's inbox |
| `relay_receive()` | Read and clear your own inbox |
| `relay_members()` | List all registered members |

## Requirements

- Node.js + `npm` available on PATH (the `create` skill runs `npm install` automatically)
- All terminals on the same machine (shared filesystem at `~/.claude/relay/`)
- Each terminal opened in a **different project directory** (relay uses project-local settings; running two terminals in the same directory makes them share an identity)

## Limitations

- **Polling, not push** — `relay_receive()` must be called explicitly; there are no background notifications.
- **One restart per terminal** — unavoidable for MCP server activation. Conversation context survives via "Resume previous conversation".
- **`.claude/settings.local.json`** — relay writes to this file in each terminal's project. Make sure your project's `.gitignore` covers it (it's per-developer config, shouldn't be committed).

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

