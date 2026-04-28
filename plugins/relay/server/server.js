#!/usr/bin/env node
// Zero-dependency MCP stdio server. The MCP wire protocol over stdio is
// just newline-delimited JSON-RPC 2.0, so we implement it directly using
// Node built-ins — no @modelcontextprotocol/sdk, no node_modules, no
// npm install at runtime.
//
// Storage model: one file per message, not a single inbox JSON. Sender
// creates a new file in <messages-dir>/<recipient>/<uuid>.json; recipient
// reads each file then unlinks it. This eliminates read-modify-write races
// (concurrent senders) and read-then-clear races (drainInbox vs. arriving
// messages), and avoids the Windows non-atomic-write problem with a single
// shared inbox file.
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
    "relay server: RELAY_DIR, RELAY_NAME, and RELAY_TEAM env vars are required\n",
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
  // Write to <path>.tmp-<rand>, then rename onto target. fs.renameSync is
  // atomic on the same filesystem on both POSIX and Windows.
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function registerSelf() {
  // members.json is still a single file. Updates are infrequent (once per
  // server start) and contention is low; atomic-rename writes are safe.
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
    description:
      "Send a message to another relay team member. The recipient sees it as a <channel> notification automatically.",
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
    description:
      "Manually read and clear your own inbox. Rarely needed — channel push delivers messages automatically.",
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
  // One file per message — no read-modify-write, no contention with other senders.
  const recipientDir = path.join(MESSAGES_DIR, to);
  fs.mkdirSync(recipientDir, { recursive: true });
  const sent = new Date().toISOString();
  // Filename starts with timestamp so listing is naturally chronological;
  // random suffix prevents collisions if two messages land in the same ms.
  const filename = `${sent.replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}.json`;
  writeJsonAtomic(path.join(recipientDir, filename), {
    from: RELAY_NAME,
    message,
    sent,
  });
  return textResult(`Sent to ${to}.`);
}

function readInboxMessages() {
  // Returns sorted-by-filename list of { path, msg } for valid messages in
  // MY_INBOX_DIR. Skips temp files and unparseable entries.
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
  } catch {
    // already gone — fine
  }
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

// --- JSON-RPC over stdio ----------------------------------------------------
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendNotification(method, params) {
  send({ jsonrpc: "2.0", method, params });
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

const SERVER_INFO = {
  name: `relay-${RELAY_TEAM}`,
  version: "1.0.10",
};

const DOTS = ['🔵','🟢','🟡','🟠','🔴','🟣','🟤'];
function dotFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return DOTS[h % DOTS.length];
}

const CAPABILITIES = {
  tools: {},
  experimental: { "claude/channel": {} },
};

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  // Notifications (no `id`) — no response.
  if (msg.id === undefined) {
    return;
  }

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

// When Claude Code closes our stdin during shutdown, exit cleanly. Without
// this, fs.watchFile keeps the event loop alive and the server lingers as
// a zombie process holding watchers.
function shutdown() {
  fs.unwatchFile(MY_INBOX_DIR);
  process.exit(0);
}
rl.on("close", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// --- Channel push: poll inbox dir, push each new message as a notification --
let debounceTimer = null;

function drainInbox() {
  const items = readInboxMessages();
  for (const { path: p, msg } of items) {
    sendNotification("notifications/claude/channel", {
      content: `${dotFor(msg.from)} [${msg.from}] > ${msg.message}`,
      meta: { from: msg.from, sent: msg.sent },
    });
    unlinkSafe(p);
  }
}

// fs.watchFile (polling) is required on Windows — fs.watch doesn't fire
// reliably for cross-process file content/dir changes there. We watch the
// inbox directory's mtime; sub-second granularity is fine for this use.
fs.watchFile(MY_INBOX_DIR, { interval: 200 }, (curr, prev) => {
  if (curr.mtimeMs === prev.mtimeMs) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(drainInbox, 50);
});

// Drain once at startup so any messages queued while we were down get pushed.
setTimeout(drainInbox, 100);
