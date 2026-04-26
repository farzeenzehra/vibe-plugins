#!/usr/bin/env node
// Zero-dependency MCP stdio server. The MCP wire protocol over stdio is
// just newline-delimited JSON-RPC 2.0, so we implement it directly using
// Node built-ins — no @modelcontextprotocol/sdk, no node_modules, no
// npm install at runtime.
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

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
const INBOX_PATH = path.join(MESSAGES_DIR, `${RELAY_NAME}.json`);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function registerSelf() {
  const members = readJson(MEMBERS_PATH, {});
  members[RELAY_NAME] = {
    role: RELAY_ROLE,
    joined: new Date().toISOString(),
  };
  writeJson(MEMBERS_PATH, members);
  if (!fs.existsSync(INBOX_PATH)) writeJson(INBOX_PATH, []);
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
  const inboxPath = path.join(MESSAGES_DIR, `${to}.json`);
  const inbox = readJson(inboxPath, []);
  inbox.push({
    from: RELAY_NAME,
    message,
    sent: new Date().toISOString(),
  });
  writeJson(inboxPath, inbox);
  return textResult(`Sent to ${to}.`);
}

function relayReceive() {
  const inbox = readJson(INBOX_PATH, []);
  writeJson(INBOX_PATH, []);
  if (inbox.length === 0) {
    return textResult("(no new messages)");
  }
  const text = inbox
    .map((m) => `[${m.sent}] ${m.from}: ${m.message}`)
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
  version: "1.0.7",
};

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

// --- Channel push: watch inbox, drain into notifications/claude/channel ----
let debounceTimer = null;

function drainInbox() {
  const inbox = readJson(INBOX_PATH, []);
  if (inbox.length === 0) return;
  writeJson(INBOX_PATH, []);
  for (const msg of inbox) {
    sendNotification("notifications/claude/channel", {
      content: `[Relay from ${msg.from}] ${msg.message}`,
      meta: { from: msg.from, sent: msg.sent },
    });
  }
}

fs.mkdirSync(MESSAGES_DIR, { recursive: true });
if (!fs.existsSync(INBOX_PATH)) writeJson(INBOX_PATH, []);
// fs.watchFile (polling) is required on Windows — fs.watch doesn't fire
// reliably for cross-process file content changes there.
fs.watchFile(INBOX_PATH, { interval: 200 }, (curr, prev) => {
  if (curr.mtimeMs === prev.mtimeMs) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(drainInbox, 50);
});
