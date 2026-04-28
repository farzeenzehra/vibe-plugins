# relay-desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork the `relay` plugin into `relay-desktop` — a version that works in the Claude desktop app by replacing channel push delivery with automatic polling via `ScheduleWakeup`.

**Architecture:** Same zero-dep stdio MCP server and file-based messaging as relay, but with channel capability stripped from the server. MCP registration writes directly to `claude_desktop_config.json` instead of using `claude mcp add`. The `relay-desktop:receive` skill self-schedules via `ScheduleWakeup` every 30s, creating a poll loop that starts when the user first runs `/relay-desktop:receive` after restarting the desktop app.

**Tech Stack:** Node.js (zero-dep stdio MCP server), bash for skill steps, `ScheduleWakeup` tool for poll loop, `claude_desktop_config.json` for MCP registration.

---

## Context for implementors

This is a plugin in the `vibe-plugins` marketplace repo at `C:\Vibe Coding\vibe-plugins`. Plugins live under `plugins/<name>/`. The marketplace catalog is `.claude-plugin/marketplace.json` — every plugin must be listed there.

### How relay (the original) works

- `relay:create <team>` / `relay:join <team> <name>` register a zero-dep MCP server via `claude mcp add --scope local`, which writes to `~/.claude.json` keyed by project path, giving each terminal its own `RELAY_NAME`.
- The MCP server (`server.js`) declares `experimental: {"claude/channel": {}}` and uses `fs.watchFile` to detect inbox changes, then pushes `notifications/claude/channel` events into the Claude Code session automatically.
- Users restart Claude Code with `--dangerously-load-development-channels plugin:relay@vibe-plugins` to activate channels.

### Why relay-desktop is different

- Claude desktop app doesn't support channels or the `--dangerously-load-development-channels` flag.
- MCP servers for the desktop app are registered in `claude_desktop_config.json`, not via `claude mcp add`.
- Without channels, messages must be fetched by polling (`relay_receive` on a timer).
- `ScheduleWakeup` is a Claude model tool that re-fires a prompt after N seconds — it creates the poll loop.

### Key design decisions

1. **One MCP entry per team** in `claude_desktop_config.json` — entry name `relay-desktop-<team>`, `RELAY_NAME` baked in. `create` uses `RELAY_NAME=lead`; `join` uses the provided agent name.
2. **Team dir**: `<CLAUDE_CONFIG_DIR>/relay-desktop/<team>/` (separate from relay's `relay/<team>/` to avoid conflicts).
3. **Bootstrap shim** references `relay-desktop@vibe-plugins` in `installed_plugins.json`.
4. **`receive` always self-schedules** — no flag needed. User runs it once after restarting the desktop app; it loops every 30s forever. Silent when inbox is empty.
5. **`create`/`join` do NOT schedule the poll** — MCP isn't connected until after restart, so ScheduleWakeup fired before restart would land with no MCP tools available. Instead, the restart instructions tell the user to run `/relay-desktop:receive` once.

### Desktop config paths by OS

| OS | Path |
|----|------|
| Windows | `$APPDATA/Claude/claude_desktop_config.json` |
| macOS | `$HOME/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `$HOME/.config/Claude/claude_desktop_config.json` |

---

## File map

| Action | Path |
|--------|------|
| Create | `plugins/relay-desktop/.claude-plugin/plugin.json` |
| Create | `plugins/relay-desktop/server/server.js` |
| Create | `plugins/relay-desktop/server/package.json` |
| Create | `plugins/relay-desktop/skills/create/SKILL.md` |
| Create | `plugins/relay-desktop/skills/join/SKILL.md` |
| Create | `plugins/relay-desktop/skills/send/SKILL.md` |
| Create | `plugins/relay-desktop/skills/receive/SKILL.md` |
| Create | `plugins/relay-desktop/skills/members/SKILL.md` |
| Create | `plugins/relay-desktop/skills/end/SKILL.md` |
| Create | `plugins/relay-desktop/README.md` |
| Modify | `.claude-plugin/marketplace.json` |

---

## Task 1: Plugin manifest and server

**Files:**
- Create: `plugins/relay-desktop/.claude-plugin/plugin.json`
- Create: `plugins/relay-desktop/server/package.json`
- Create: `plugins/relay-desktop/server/server.js`

- [ ] **Step 1: Create `plugin.json`**

```json
{
  "name": "relay-desktop",
  "description": "Cross-session Claude desktop messaging via MCP with auto-polling. No channels required — works in the Claude desktop app. Polling starts automatically after joining.",
  "version": "1.0.0",
  "author": {
    "name": "Farzeen Zehra"
  }
}
```

- [ ] **Step 2: Create `server/package.json`**

```json
{
  "name": "relay-desktop-server",
  "version": "1.0.0",
  "description": "Zero-dependency stdio MCP server for relay-desktop messaging (no channel push — polling only)",
  "type": "module",
  "private": true,
  "main": "server.js"
}
```

- [ ] **Step 3: Create `server/server.js`**

Fork of relay's server.js with three things removed:
- `experimental: {"claude/channel": {}}` from CAPABILITIES
- `drainInbox()` function and its `setTimeout(drainInbox, 100)` startup call
- `fs.watchFile(MY_INBOX_DIR, ...)` and the `debounceTimer` logic
- `sendNotification()` function (no longer needed)

Also update `SERVER_INFO.version` to `"1.0.0"` and the tool description for `relay_receive` to remove the "rarely needed" framing.

```js
#!/usr/bin/env node
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RELAY_DIR = process.env.RELAY_DIR;
const RELAY_NAME = process.env.RELAY_NAME;
const RELAY_TEAM = process.env.RELAY_TEAM;
const RELAY_ROLE = process.env.RELAY_ROLE || "agent";

if (!RELAY_DIR || !RELAY_NAME || !RELAY_TEAM) {
  process.stderr.write(
    "relay-desktop server: RELAY_DIR, RELAY_NAME, and RELAY_TEAM env vars are required\n",
  );
  process.exit(1);
}

const MEMBERS_PATH = path.join(RELAY_DIR, "members.json");
const MESSAGES_DIR = path.join(RELAY_DIR, "messages");
const MY_INBOX_DIR = path.join(MESSAGES_DIR, RELAY_NAME);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function registerSelf() {
  const members = readJson(MEMBERS_PATH, {});
  members[RELAY_NAME] = {
    role: RELAY_ROLE,
    joined: new Date().toISOString(),
  };
  writeJsonAtomic(MEMBERS_PATH, members);
  fs.mkdirSync(MY_INBOX_DIR, { recursive: true });
}

registerSelf();

const TOOLS = [
  {
    name: "relay_send",
    description: "Send a message to another relay team member.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient's relay name (see relay_members)",
        },
        message: { type: "string", description: "Message content" },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "relay_receive",
    description: "Read and clear your own inbox. Called automatically by the poll loop.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "relay_members",
    description: "List all members currently registered in the relay team.",
    inputSchema: { type: "object", properties: {} },
  },
];

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function errorResult(text) {
  return { content: [{ type: "text", text }], isError: true };
}

function relaySend(args) {
  const to = args?.to;
  const message = args?.message;
  if (typeof to !== "string" || typeof message !== "string") {
    return errorResult("relay_send requires string 'to' and 'message' arguments");
  }
  const members = readJson(MEMBERS_PATH, {});
  if (!members[to]) {
    const known = Object.keys(members).join(", ") || "(none)";
    return errorResult(`Unknown member "${to}". Known members: ${known}`);
  }
  const recipientDir = path.join(MESSAGES_DIR, to);
  fs.mkdirSync(recipientDir, { recursive: true });
  const sent = new Date().toISOString();
  const filename = `${sent.replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}.json`;
  writeJsonAtomic(path.join(recipientDir, filename), {
    from: RELAY_NAME,
    message,
    sent,
  });
  return textResult(`Sent to ${to}.`);
}

function readInboxMessages() {
  let entries;
  try {
    entries = fs.readdirSync(MY_INBOX_DIR);
  } catch {
    return [];
  }
  const result = [];
  for (const name of entries.sort()) {
    if (!name.endsWith(".json")) continue;
    if (name.includes(".tmp-")) continue;
    const p = path.join(MY_INBOX_DIR, name);
    const msg = readJson(p, null);
    if (msg && typeof msg === "object" && msg.message) {
      result.push({ path: p, msg });
    }
  }
  return result;
}

function unlinkSafe(p) {
  try {
    fs.unlinkSync(p);
  } catch {}
}

function relayReceive() {
  const items = readInboxMessages();
  for (const item of items) unlinkSafe(item.path);
  if (items.length === 0) return textResult("(no new messages)");
  const text = items
    .map(({ msg }) => `${dotFor(msg.from)} [${msg.from}] > ${msg.message}`)
    .join("\n");
  return textResult(text);
}

function relayMembers() {
  const members = readJson(MEMBERS_PATH, {});
  const entries = Object.entries(members);
  if (entries.length === 0) return textResult("(no members registered)");
  const text = entries
    .map(([name, info]) => `- ${name} (${info.role}, joined ${info.joined})`)
    .join("\n");
  return textResult(text);
}

function callTool(name, args) {
  switch (name) {
    case "relay_send":
      return relaySend(args);
    case "relay_receive":
      return relayReceive();
    case "relay_members":
      return relayMembers();
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

const SERVER_INFO = {
  name: `relay-desktop-${RELAY_TEAM}`,
  version: "1.0.0",
};

const DOTS = ['🔵','🟢','🟡','🟠','🔴','🟣','🟤'];
function dotFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return DOTS[h % DOTS.length];
}

const CAPABILITIES = { tools: {} };

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === undefined) return;

  switch (msg.method) {
    case "initialize":
      sendResult(msg.id, {
        protocolVersion: msg.params?.protocolVersion || "2024-11-05",
        serverInfo: SERVER_INFO,
        capabilities: CAPABILITIES,
      });
      break;
    case "tools/list":
      sendResult(msg.id, { tools: TOOLS });
      break;
    case "tools/call": {
      const result = callTool(msg.params?.name, msg.params?.arguments);
      sendResult(msg.id, result);
      break;
    }
    case "ping":
      sendResult(msg.id, {});
      break;
    default:
      sendError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
});

function shutdown() {
  process.exit(0);
}
rl.on("close", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

- [ ] **Step 4: Validate JS syntax**

```bash
node --check "plugins/relay-desktop/server/server.js"
```

Expected: no output (no errors).

- [ ] **Step 5: Commit**

```bash
git add plugins/relay-desktop/
git commit -m "relay-desktop: 1.0.0 — initial server (no channels, polling-only)"
```

---

## Task 2: `create` skill

**Files:**
- Create: `plugins/relay-desktop/skills/create/SKILL.md`

The `create` skill is the largest skill. It:
1. Resolves paths (CLAUDE_CONFIG_DIR for team dir; OS-specific path for desktop config)
2. Bails if team already exists
3. Creates TEAM_DIR and writes the bootstrap shim (referencing `relay-desktop@vibe-plugins`)
4. Reads `claude_desktop_config.json`, merges in the new MCP entry, writes it back atomically
5. Prints restart instructions telling the user to run `/relay-desktop:receive` after restarting

- [ ] **Step 1: Create `skills/create/SKILL.md`**

```markdown
---
name: create
description: Create a relay-desktop team in this session. Works in Claude desktop app — no channels or special restart flags needed. Writes the MCP entry to claude_desktop_config.json. After restarting the desktop app, run /relay-desktop:receive once to start auto-polling.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

Set up a relay-desktop team named "$team_name" rooted in this session as the lead.

## Step 1 — Resolve paths

Detect the active Claude data dir from the `CLAUDE_CONFIG_DIR` env var:

```bash
CLAUDE_DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

Convert any backslashes to forward slashes (Windows safety).

Define:
- TEAM_DIR = `CLAUDE_DATA_DIR/relay-desktop/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`
- PLUGINS_FILE = `CLAUDE_DATA_DIR/plugins/installed_plugins.json`

Detect the Claude desktop config path based on OS:
- Windows (WINDIR or APPDATA set): `$APPDATA/Claude/claude_desktop_config.json`
- macOS (uname == Darwin): `$HOME/Library/Application Support/Claude/claude_desktop_config.json`
- Linux fallback: `$HOME/.config/Claude/claude_desktop_config.json`

Bash detection:
```bash
if [[ -n "$APPDATA" ]]; then
  DESKTOP_CONFIG="${APPDATA}/Claude/claude_desktop_config.json"
elif [[ "$(uname)" == "Darwin" ]]; then
  DESKTOP_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
  DESKTOP_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
fi
```

Convert backslashes to forward slashes on Windows.

## Step 2 — Bail if the team already exists

If `TEAM_DIR` exists, print:

  Relay-desktop team "$team_name" already exists at TEAM_DIR.
  To rebuild it from scratch, run:
    /relay-desktop:end $team_name
  then re-run this command.

And stop.

## Step 3 — Create the team directory and write the bootstrap shim

Create `TEAM_DIR` recursively (Bash: `mkdir -p "$TEAM_DIR"`).

Write `SERVER_PATH` (`TEAM_DIR/server.js`) with this exact content — it dynamically resolves the installed relay-desktop plugin path at startup:

```js
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const pluginsFile = path.join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
const { plugins } = JSON.parse(readFileSync(pluginsFile, 'utf8'));
const entry = plugins['relay-desktop@vibe-plugins']?.[0];
if (!entry) throw new Error('relay-desktop@vibe-plugins not installed');
await import(pathToFileURL(path.join(entry.installPath, 'server', 'server.js')).href);
```

Also copy `${CLAUDE_PLUGIN_ROOT}/server/package.json` → `TEAM_DIR/package.json` (marks the dir as ESM so Node accepts `await import()`).

## Step 4 — Register MCP server in claude_desktop_config.json

Use Node.js to read, merge, and atomically write the desktop config:

```bash
node -e "
const fs = require('fs');
const configPath = process.argv[1];
const teamName = process.argv[2];
const serverPath = process.argv[3];
const teamDir = process.argv[4];

let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
config.mcpServers = config.mcpServers || {};
config.mcpServers['relay-desktop-' + teamName] = {
  command: 'node',
  args: [serverPath],
  env: {
    RELAY_TEAM: teamName,
    RELAY_NAME: 'lead',
    RELAY_ROLE: 'lead',
    RELAY_DIR: teamDir
  }
};
const tmp = configPath + '.tmp-' + Math.random().toString(36).slice(2);
fs.mkdirSync(require('path').dirname(configPath), { recursive: true });
fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
fs.renameSync(tmp, configPath);
console.log('done');
" "$DESKTOP_CONFIG" "$team_name" "$SERVER_PATH" "$TEAM_DIR"
```

If this exits non-zero, print the error and stop.

Print: `✓ Added "relay-desktop-$team_name" (RELAY_NAME=lead) to DESKTOP_CONFIG`.

## Step 5 — Print restart instructions

Print exactly:

Relay-desktop team "$team_name" is set up.

The MCP server entry "relay-desktop-$team_name" has been added to your Claude desktop config.

Next steps:
  1. Quit and relaunch the Claude desktop app.
  2. Open a new conversation (or resume this one).
  3. Run: /relay-desktop:receive
     This starts the auto-poll loop — you'll receive messages every 30 seconds automatically.

To bring another session into this team, in that session run:
  /relay-desktop:join $team_name <agent-name>

To clean up later:
  /relay-desktop:end $team_name
```

- [ ] **Step 2: Verify the skill file is valid (no invisible issues)**

```bash
node -e "const fs = require('fs'); const t = fs.readFileSync('plugins/relay-desktop/skills/create/SKILL.md','utf8'); console.log('lines:', t.split('\n').length, 'ok');"
```

- [ ] **Step 3: Commit**

```bash
git add plugins/relay-desktop/skills/create/
git commit -m "relay-desktop: add create skill"
```

---

## Task 3: `join` skill

**Files:**
- Create: `plugins/relay-desktop/skills/join/SKILL.md`

Fork of `create` skill with these changes:
- Takes two arguments: `team_name`, `agent_name`
- Validates `agent_name != "lead"`
- Checks `relay-desktop-$team_name` already exists in desktop config (guards against clobbering)
- Writes `RELAY_NAME=$agent_name`, `RELAY_ROLE=agent` into the desktop config entry

- [ ] **Step 1: Create `skills/join/SKILL.md`**

```markdown
---
name: join
description: Join an existing relay-desktop team from another Claude desktop session. Run after the lead session has run /relay-desktop:create. Adds an MCP entry to claude_desktop_config.json with your chosen name. After restarting the desktop app, run /relay-desktop:receive once to start auto-polling.
argument-hint: <team-name> <agent-name>
arguments: [team_name, agent_name]
allowed-tools: Bash Read Write
---

Join the relay-desktop team "$team_name" as "$agent_name".

## Step 1 — Resolve paths

Detect the active Claude data dir from the `CLAUDE_CONFIG_DIR` env var:

```bash
CLAUDE_DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

Convert backslashes to forward slashes.

Define:
- TEAM_DIR = `CLAUDE_DATA_DIR/relay-desktop/$team_name`
- SERVER_PATH = `TEAM_DIR/server.js`

Detect the Claude desktop config path:

```bash
if [[ -n "$APPDATA" ]]; then
  DESKTOP_CONFIG="${APPDATA}/Claude/claude_desktop_config.json"
elif [[ "$(uname)" == "Darwin" ]]; then
  DESKTOP_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
  DESKTOP_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
fi
```

## Step 2 — Verify the team exists

Check that `SERVER_PATH` exists. If it does not, print:

  Relay-desktop team "$team_name" not found at TEAM_DIR.
  In the lead session, run:
    /relay-desktop:create $team_name
  Then re-run this command here.

And stop.

## Step 3 — Sanity check the agent name

If `$agent_name` is `"lead"`, print:

  The name "lead" is reserved for the session that ran /relay-desktop:create.
  Pick a different agent name (e.g. "agent1", "fe", "backend").

And stop.

## Step 4 — Guard against clobbering an existing entry

Read `DESKTOP_CONFIG` with Node.js and check if `config.mcpServers["relay-desktop-$team_name"]` already exists:

```bash
node -e "
const fs = require('fs');
try {
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const entry = c.mcpServers && c.mcpServers['relay-desktop-' + process.argv[2]];
  if (entry) console.log(entry.env && entry.env.RELAY_NAME || 'unknown');
} catch {}
" "$DESKTOP_CONFIG" "$team_name"
```

If this prints a name:
- If that name == `"$agent_name"`, proceed (re-joining under the same name is fine — step 5 will overwrite cleanly).
- Otherwise, print:

  The claude_desktop_config.json already has a "relay-desktop-$team_name" entry
  with RELAY_NAME=<existing-name>. Overwriting it would break that session.

  Options:
  1. Ask that session to run /relay-desktop:end $team_name, then retry here.
  2. Create a second relay team with a different name.

And stop.

## Step 5 — Register MCP server in claude_desktop_config.json

```bash
node -e "
const fs = require('fs');
const configPath = process.argv[1];
const teamName = process.argv[2];
const agentName = process.argv[3];
const serverPath = process.argv[4];
const teamDir = process.argv[5];

let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
config.mcpServers = config.mcpServers || {};
config.mcpServers['relay-desktop-' + teamName] = {
  command: 'node',
  args: [serverPath],
  env: {
    RELAY_TEAM: teamName,
    RELAY_NAME: agentName,
    RELAY_ROLE: 'agent',
    RELAY_DIR: teamDir
  }
};
const tmp = configPath + '.tmp-' + Math.random().toString(36).slice(2);
fs.mkdirSync(require('path').dirname(configPath), { recursive: true });
fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
fs.renameSync(tmp, configPath);
console.log('done');
" "$DESKTOP_CONFIG" "$team_name" "$agent_name" "$SERVER_PATH" "$TEAM_DIR"
```

If this exits non-zero, print the error and stop.

Print: `✓ Added "relay-desktop-$team_name" (RELAY_NAME=$agent_name) to DESKTOP_CONFIG`.

## Step 6 — Print restart instructions

Print exactly:

Joined relay-desktop team "$team_name" as "$agent_name".

The MCP server entry "relay-desktop-$team_name" has been added to your Claude desktop config.

Next steps:
  1. Quit and relaunch the Claude desktop app.
  2. Open a new conversation (or resume this one).
  3. Run: /relay-desktop:receive
     This starts the auto-poll loop — you'll receive messages every 30 seconds automatically.

To leave the team later:
  /relay-desktop:end $team_name
```

- [ ] **Step 2: Commit**

```bash
git add plugins/relay-desktop/skills/join/
git commit -m "relay-desktop: add join skill"
```

---

## Task 4: `receive` skill (the poll loop)

**Files:**
- Create: `plugins/relay-desktop/skills/receive/SKILL.md`

This is the core innovation over relay. Every time this skill runs, it:
1. Calls `relay_receive` MCP tool
2. If there are messages, prints them
3. Always calls `ScheduleWakeup` to re-fire itself in 30 seconds

The user runs this once after restarting the desktop app. After that, it's automatic.

- [ ] **Step 1: Create `skills/receive/SKILL.md`**

```markdown
---
name: receive
description: Check your inbox in the relay-desktop team and start the auto-poll loop. Run once after restarting the desktop app — it will automatically re-check every 30 seconds. No channels needed. Only works if relay-desktop-<team> MCP server is connected.
allowed-tools: mcp__*__relay_receive ScheduleWakeup
---

Check the relay-desktop inbox and schedule the next check.

## Step 1 — Check MCP connection

Look for a connected `relay-desktop-*` MCP server (a tool named `relay_receive` from a server whose name starts with `relay-desktop-`). If none is connected, print:

  No relay-desktop team is connected. Run /relay-desktop:join <team> <name> first,
  then restart the Claude desktop app, then run /relay-desktop:receive.

And stop (do NOT call ScheduleWakeup — there's no point polling without the MCP tool).

## Step 2 — Drain inbox

Call the `relay_receive` tool from the connected `relay-desktop-*` server.

If the result is "(no new messages)", print nothing — stay silent.

If there are messages, print them verbatim.

## Step 3 — Schedule next poll

Call ScheduleWakeup with:
- delaySeconds: 30
- prompt: "/relay-desktop:receive"
- reason: "relay-desktop poll — checking inbox"

Do not print anything about the scheduling. It is an internal detail.
```

- [ ] **Step 2: Commit**

```bash
git add plugins/relay-desktop/skills/receive/
git commit -m "relay-desktop: add receive skill with ScheduleWakeup poll loop"
```

---

## Task 5: `send`, `members`, and `end` skills

**Files:**
- Create: `plugins/relay-desktop/skills/send/SKILL.md`
- Create: `plugins/relay-desktop/skills/members/SKILL.md`
- Create: `plugins/relay-desktop/skills/end/SKILL.md`

- [ ] **Step 1: Create `skills/send/SKILL.md`**

Near-identical to relay's send skill. Update the error message to reference `relay-desktop:create`/`relay-desktop:join` and omit the `--dangerously-load-development-channels` requirement.

```markdown
---
name: send
description: Send a message to another member of the relay-desktop team. Thin wrapper around the relay_send MCP tool. The recipient will see it on their next poll (every 30s). Only works if relay-desktop-<team> MCP server is connected.
argument-hint: <to> <message...>
arguments: [to, message]
allowed-tools: mcp__*__relay_send
---

Call the `relay_send` tool from the connected `relay-desktop-*` MCP server with `to="$to"` and `message="$message"`, then print the tool's result.

If no `relay-desktop-*` server is connected, print:

  No relay-desktop team is connected in this session. Run /relay-desktop:create <team>
  or /relay-desktop:join <team> <name> first, then restart the Claude desktop app.

If multiple `relay-desktop-*` servers are connected and the recipient is ambiguous, ask the user which team to send through before calling.
```

- [ ] **Step 2: Create `skills/members/SKILL.md`**

```markdown
---
name: members
description: List all members currently registered in the relay-desktop team. Thin wrapper around the relay_members MCP tool. Only works if relay-desktop-<team> MCP server is connected.
allowed-tools: mcp__*__relay_members
---

Call the `relay_members` tool from the connected `relay-desktop-*` MCP server and print its output verbatim.

If multiple `relay-desktop-*` servers are connected, call each one and label output by team. If none are connected, print:

  No relay-desktop team is connected in this session. Run /relay-desktop:create <team>
  or /relay-desktop:join <team> <name>, then restart the Claude desktop app.
```

- [ ] **Step 3: Create `skills/end/SKILL.md`**

Removes the MCP entry from `claude_desktop_config.json` and deletes the team directory.

```markdown
---
name: end
description: End a relay-desktop team. Removes the MCP entry from claude_desktop_config.json and deletes the shared team directory. Run in every session that joined to fully clean up.
argument-hint: <team-name>
arguments: [team_name]
allowed-tools: Bash Read Write
---

End the relay-desktop team named "$team_name".

## Step 1 — Resolve paths

Detect the active Claude data dir from the `CLAUDE_CONFIG_DIR` env var:

```bash
CLAUDE_DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

Define TEAM_DIR = `CLAUDE_DATA_DIR/relay-desktop/$team_name`.

Detect the Claude desktop config path:

```bash
if [[ -n "$APPDATA" ]]; then
  DESKTOP_CONFIG="${APPDATA}/Claude/claude_desktop_config.json"
elif [[ "$(uname)" == "Darwin" ]]; then
  DESKTOP_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
  DESKTOP_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
fi
```

## Step 2 — Remove MCP entry from claude_desktop_config.json

```bash
node -e "
const fs = require('fs');
const configPath = process.argv[1];
const key = 'relay-desktop-' + process.argv[2];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(0); }
if (!config.mcpServers || !config.mcpServers[key]) {
  console.log('not-found');
  process.exit(0);
}
delete config.mcpServers[key];
const tmp = configPath + '.tmp-' + Math.random().toString(36).slice(2);
fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
fs.renameSync(tmp, configPath);
console.log('removed');
" "$DESKTOP_CONFIG" "$team_name"
```

If output is `removed`: print `✓ Removed "relay-desktop-$team_name" from DESKTOP_CONFIG`.
If output is `not-found`: print `(entry "relay-desktop-$team_name" was not in DESKTOP_CONFIG — already removed)`.

## Step 3 — Delete the shared team directory

If `TEAM_DIR` exists, delete it recursively:

```bash
rm -rf "$TEAM_DIR"
```

Print `✓ Deleted TEAM_DIR` or `(team directory was already gone)`.

## Step 4 — Print restart hint

Print exactly:

Relay-desktop team "$team_name" cleaned up.

Restart the Claude desktop app to fully unload the MCP server.

Other sessions that joined this team should also run:
  /relay-desktop:end $team_name
…to remove their own entries.
```

- [ ] **Step 4: Commit**

```bash
git add plugins/relay-desktop/skills/
git commit -m "relay-desktop: add send, members, end skills"
```

---

## Task 6: Marketplace registration and README

**Files:**
- Modify: `.claude-plugin/marketplace.json`
- Create: `plugins/relay-desktop/README.md`

- [ ] **Step 1: Add relay-desktop to marketplace.json**

Current content of `.claude-plugin/marketplace.json`:
```json
{
  "name": "vibe-plugins",
  "owner": { "name": "Farzeen Zehra" },
  "plugins": [
    { "name": "squad", "source": "./plugins/squad", "description": "..." },
    { "name": "relay", "source": "./plugins/relay", "description": "..." }
  ]
}
```

Add after the `relay` entry:
```json
{
  "name": "relay-desktop",
  "source": "./plugins/relay-desktop",
  "description": "Cross-session Claude desktop messaging via MCP with auto-polling — no channels or special flags needed"
}
```

- [ ] **Step 2: Validate marketplace.json**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Create `plugins/relay-desktop/README.md`**

```markdown
# relay-desktop

Cross-session Claude **desktop app** messaging via MCP — **no channels, no special flags, no `--dangerously-load-development-channels`**.

A fork of `relay` for users who prefer the Claude desktop app over the CLI. Uses automatic 30-second polling via `ScheduleWakeup` instead of channel push delivery.

## Skills

| Skill | Description |
|---|---|
| `/relay-desktop:create <team>` | Set up a team in this session (lead) |
| `/relay-desktop:join <team> <name>` | Join an existing team from another session |
| `/relay-desktop:receive` | Check inbox + start auto-poll loop (run once after restart) |
| `/relay-desktop:send <to> <message>` | Send a message to a team member |
| `/relay-desktop:members` | List registered members |
| `/relay-desktop:end <team>` | Remove MCP entry and clean up |

## How it works

- Same zero-dep stdio MCP server and file-based message storage as `relay`.
- MCP registration writes directly to `claude_desktop_config.json` (no `claude` CLI required).
- After restarting the desktop app, run `/relay-desktop:receive` once. It checks your inbox, then calls `ScheduleWakeup` to re-fire itself 30 seconds later — creating a continuous poll loop.
- Messages appear with up to 30s latency (vs. instant push in relay).

## Usage

**Step 1 — In the lead session:**
```
/relay-desktop:create my-team
```

**Step 2 — Restart the Claude desktop app.**

**Step 3 — Run the poll loop:**
```
/relay-desktop:receive
```

**Step 4 — In a second session:**
```
/relay-desktop:join my-team agent1
```
Restart the app, then run `/relay-desktop:receive` there too.

**Step 5 — Message back and forth:**
```
/relay-desktop:send agent1 hey, can you look at X?
```
Agent1 sees the message within 30 seconds (on their next poll tick).

## vs. relay

| | relay | relay-desktop |
|---|---|---|
| Environment | Claude Code CLI | Claude desktop app |
| Delivery | Push via channels (instant) | Poll every 30s |
| Restart command | `claude --dangerously-load-development-channels plugin:relay@vibe-plugins` | Just restart the app |
| Requires claude.ai login | Yes (channels) | No extra requirement |

## Installation

```
/plugin marketplace add farzeenzehra/vibe-plugins
/plugin install relay-desktop@vibe-plugins
```

## Requirements

- Node.js on PATH
- Claude desktop app installed
- Both sessions on the same machine (shared filesystem)
```

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json plugins/relay-desktop/README.md
git commit -m "relay-desktop: add marketplace entry and README"
```

---

## Task 7: Dry-run validation

Before pushing, verify the plugin is structurally sound.

- [ ] **Step 1: Validate plugin.json**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/relay-desktop/.claude-plugin/plugin.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 2: Validate server.js syntax**

```bash
node --check plugins/relay-desktop/server/server.js
```

Expected: no output.

- [ ] **Step 3: Smoke-test the server**

Spawn the server with required env vars to verify it starts, registers itself, and responds to MCP initialize:

```bash
RELAY_DIR=/tmp/relay-desktop-test RELAY_NAME=testlead RELAY_TEAM=testteam RELAY_ROLE=lead \
  node plugins/relay-desktop/server/server.js &
SERVER_PID=$!
sleep 0.5
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}' | \
  node -e "
    const {execSync} = require('child_process');
    // just test that the process started
    process.exit(0);
  "
kill $SERVER_PID 2>/dev/null
ls /tmp/relay-desktop-test/
```

Expected: `/tmp/relay-desktop-test/` contains `members.json` and `messages/testlead/`.

- [ ] **Step 4: Run `claude plugin validate`**

```bash
claude plugin validate plugins/relay-desktop
```

Expected: `✔ Validation passed`

- [ ] **Step 5: Verify all skill files exist**

```bash
for skill in create join send receive members end; do
  test -f "plugins/relay-desktop/skills/$skill/SKILL.md" && echo "✓ $skill" || echo "✗ MISSING: $skill"
done
```

Expected: all six lines start with `✓`.

---

## Self-review checklist

- [ ] **Spec coverage:** Does the plan implement all six skills (create, join, send, receive, members, end)? Yes. Does it handle the polling loop? Yes (Task 4). Does it handle desktop config registration and cleanup? Yes (Tasks 2, 3, 5). Is marketplace.json updated? Yes (Task 6).
- [ ] **No channels:** server.js has no `experimental: {"claude/channel": {}}`, no `watchFile`, no `drainInbox`, no `sendNotification`. Confirmed — Task 1 strips all of these.
- [ ] **Placeholder scan:** No TBDs, no "fill in later", no "similar to Task N" — each task has complete file content.
- [ ] **Type consistency:** No types to worry about (JS not TS). Tool names `relay_send`/`relay_receive`/`relay_members` used consistently throughout all skills and server.js.
- [ ] **Bootstrap shim:** References `relay-desktop@vibe-plugins` (not `relay@vibe-plugins`). Confirmed in Task 2.
- [ ] **TEAM_DIR path:** Uses `relay-desktop/` not `relay/` to avoid collision. Confirmed in Tasks 2, 3, 5.
- [ ] **MCP entry name:** `relay-desktop-$team_name` throughout. Confirmed.
- [ ] **ScheduleWakeup stop condition:** If MCP disconnects (session ends), the skill exits early in Step 1 and does NOT reschedule. Loop terminates naturally. Confirmed in Task 4.
