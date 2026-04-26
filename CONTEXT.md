# vibe-plugins — Session Context

This document gives a fresh Claude Code session everything it needs to continue building this repo.
Open `C:/Vibe Coding/vibe-plugins` as your working directory and read this file first.

---

## What this repo is

A public Claude Code plugin marketplace at **github.com/farzeenzehra/vibe-plugins**.

Users install it with:
```
/plugin marketplace add farzeenzehra/vibe-plugins
/plugin install <plugin-name>@vibe-plugins
```

Repo structure:
```
vibe-plugins/
├── .claude-plugin/
│   └── marketplace.json       ← catalog of all plugins
├── plugins/
│   ├── squad/                 ← DONE: first plugin
│   └── relay/                 ← IN PROGRESS: second plugin
└── README.md
```

---

## Plugin 1: squad (DONE)

Coordinates Claude Code agents across terminals using native `TeamCreate`/`TeamDelete`/`SendMessage` tools.

**Skills:**
- `/squad:new-team <team-name>` — enables `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`, calls `TeamCreate`, prints lead session ID
- `/squad:add-agent <agent-name>` — reads `~/.claude/teams/` to find active team, prints ready-to-paste startup commands in Bash/PowerShell/CMD for the agent terminal
- `/squad:end-team <team-name>` — calls `TeamDelete`, lists active teams if name not found

**Limitation:** agent terminal must paste a startup command and open a FRESH Claude session. Existing context in agent terminal is lost.

---

## Plugin 2: relay (IN PROGRESS — next task)

Solves the squad limitation: both terminals keep their existing conversation context, restart once, then have shared messaging tools.

### How it works

Architecture: **file-based stdio MCP server** (no HTTP daemon, no port management).

- Each terminal runs its own Node.js subprocess as an MCP stdio server
- All subprocesses share state via files in `~/.claude/relay/<team-name>/`
- Adding an MCP server to `~/.claude/settings.json` + restarting Claude Code preserves conversation history (user picks "resume previous conversation" on restart)

### Workflow

**Terminal 1 (lead):**
```
/relay:create my-team
```
→ Writes server.js + package.json to `~/.claude/relay/my-team/`
→ Runs `npm install` in that directory
→ Adds MCP server config to `~/.claude/settings.json`
→ Tells user to restart Claude Code
→ After restart: user resumes previous conversation + has relay MCP tools

**Terminal 2 (agent):**
```
/relay:join my-team agent1
```
→ Reads `~/.claude/relay/my-team/` to confirm team exists
→ Adds same MCP server config to `~/.claude/settings.json` (with different env vars: RELAY_NAME=agent1, RELAY_ROLE=agent)
→ Tells user to restart Claude Code
→ After restart: user resumes previous conversation + has relay MCP tools

**Messaging (after both restart):**
- Lead: `relay_send("agent1", "do X")` → writes to `~/.claude/relay/my-team/messages/agent1.json`
- Agent: `relay_receive()` → reads and clears its own inbox
- Both: `relay_members()` → see who's registered

**Cleanup:**
```
/relay:end my-team
```
→ Removes MCP from settings.json
→ Deletes `~/.claude/relay/my-team/`

### File layout during a live relay session

```
~/.claude/relay/
└── my-team/
    ├── members.json            ← { "lead": { "role": "lead", "joined": "..." }, "agent1": { ... } }
    ├── messages/
    │   ├── lead.json           ← inbox for lead
    │   └── agent1.json         ← inbox for agent1
    └── node_modules/           ← after npm install
        ...
    (server.js and package.json also live here)
```

### MCP config written to settings.json

For the lead:
```json
{
  "mcpServers": {
    "relay-my-team": {
      "command": "node",
      "args": ["C:/Users/<user>/.claude/relay/my-team/server.js"],
      "env": {
        "RELAY_TEAM": "my-team",
        "RELAY_NAME": "lead",
        "RELAY_ROLE": "lead",
        "RELAY_DIR": "C:/Users/<user>/.claude/relay/my-team"
      }
    }
  }
}
```

For the agent (same server, different env):
```json
{
  "mcpServers": {
    "relay-my-team": {
      "command": "node",
      "args": ["C:/Users/<user>/.claude/relay/my-team/server.js"],
      "env": {
        "RELAY_TEAM": "my-team",
        "RELAY_NAME": "agent1",
        "RELAY_ROLE": "agent",
        "RELAY_DIR": "C:/Users/<user>/.claude/relay/my-team"
      }
    }
  }
}
```

### MCP tools the server exposes

| Tool | Description |
|---|---|
| `relay_send(to, message)` | Write a message to another member's inbox |
| `relay_receive()` | Read and clear own inbox (returns array of messages) |
| `relay_members()` | List all registered team members |

The server registers itself on startup by writing to `members.json` using env vars (RELAY_NAME, RELAY_ROLE, RELAY_TEAM).

### server.js design notes

- Pure Node.js stdio MCP server using `@modelcontextprotocol/sdk`
- Uses the SDK's `Server` + `StdioServerTransport`
- On startup: reads env vars, writes self to members.json
- Tools use synchronous `fs` operations (simple JSON files, no race conditions at this scale)
- package.json: `{ "dependencies": { "@modelcontextprotocol/sdk": "^1.0.0" } }`

### Skills design notes

- Do NOT use `disable-model-invocation: true` on relay skills — they need conditional logic (check if npm install succeeded, check if team exists, etc.)
- The `create` skill needs `Bash` in allowed-tools to run `npm install` and start background processes
- The `join` skill needs `Read` + `Write` to update settings.json
- The `end` skill needs `Bash` + `Write` to clean up

---

## Files still to create for relay

- [ ] `plugins/relay/.claude-plugin/plugin.json`
- [ ] `plugins/relay/server/server.js`
- [ ] `plugins/relay/server/package.json`
- [ ] `plugins/relay/skills/create/SKILL.md`
- [ ] `plugins/relay/skills/join/SKILL.md`
- [ ] `plugins/relay/skills/end/SKILL.md`
- [ ] `plugins/relay/README.md`
- [ ] Update `.claude-plugin/marketplace.json` to add relay entry

---

## Key decisions already made

1. **File-based, not HTTP** — avoids port management and daemon crashes
2. **stdio MCP, not HTTP MCP** — each Claude instance spawns its own subprocess; shared state via files
3. **One restart required** — unavoidable for MCP server activation, but context is preserved via resume
4. **Polling, not push** — `relay_receive()` must be called explicitly; no background notifications
5. **Context is preserved** — unlike squad's add-agent which starts a fresh session, relay restarts resume the existing conversation
6. **npm required** — server.js uses `@modelcontextprotocol/sdk`; the create skill runs `npm install` automatically

---

## GitHub

Repo: `https://github.com/farzeenzehra/vibe-plugins`
Branch: `master`
Git user: Farzeen Zehra

Push after any significant changes.
