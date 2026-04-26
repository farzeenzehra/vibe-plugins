#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";

const RELAY_DIR = process.env.RELAY_DIR;
const RELAY_NAME = process.env.RELAY_NAME;
const RELAY_TEAM = process.env.RELAY_TEAM;
const RELAY_ROLE = process.env.RELAY_ROLE || "agent";

if (!RELAY_DIR || !RELAY_NAME || !RELAY_TEAM) {
  console.error(
    "relay server: RELAY_DIR, RELAY_NAME, and RELAY_TEAM env vars are required",
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
      "Send a message to another relay team member's inbox. The recipient picks it up with relay_receive.",
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
      "Read and clear your own inbox. Returns all messages waiting for you, then empties it.",
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

const server = new Server(
  { name: `relay-${RELAY_TEAM}`, version: "1.0.0" },
  {
    capabilities: {
      tools: {},
      experimental: { "claude/channel": {} },
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
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
});

await server.connect(new StdioServerTransport());

// Watch inbox for incoming messages and push them as channel notifications
let debounceTimer = null;

async function drainInbox() {
  const inbox = readJson(INBOX_PATH, []);
  if (inbox.length === 0) return;
  writeJson(INBOX_PATH, []);
  for (const msg of inbox) {
    await server.notification({
      method: "notifications/claude/channel",
      params: {
        content: `[Relay from ${msg.from}] ${msg.message}`,
        meta: { from: msg.from, sent: msg.sent },
      },
    });
  }
}

fs.mkdirSync(MESSAGES_DIR, { recursive: true });
if (!fs.existsSync(INBOX_PATH)) writeJson(INBOX_PATH, []);
// Use fs.watchFile (polling) instead of fs.watch — fs.watch is unreliable on
// Windows for cross-process file content changes, fs.watchFile polls and works.
fs.watchFile(INBOX_PATH, { interval: 200 }, (curr, prev) => {
  if (curr.mtimeMs === prev.mtimeMs) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(drainInbox, 50);
});
