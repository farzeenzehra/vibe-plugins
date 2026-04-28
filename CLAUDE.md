# vibe-plugins

Public Claude Code plugin marketplace. Repo: `github.com/farzeenzehra/vibe-plugins`, default branch `master`.

## Layout

- `.claude-plugin/marketplace.json` — catalog. **Every plugin must be listed here or `/plugin install <name>@vibe-plugins` fails.**
- `plugins/<name>/.claude-plugin/plugin.json` — plugin manifest
- `plugins/<name>/skills/<skill>/SKILL.md` — slash-command skill
- `plugins/<name>/server/` — bundled MCP server (currently only `relay`)
- `CONTEXT.md` — gitignored session-handoff doc; read it first if present

## Adding a new plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json`, `skills/`, `README.md`
2. Add entry to `.claude-plugin/marketplace.json` (easy to forget)
3. Update top-level `README.md` plugin table

## Skill frontmatter conventions (this repo)

- `allowed-tools` is **space-separated**, not comma-separated (`Read Write Bash`)
- `arguments: [name1, name2]` makes the body able to reference `$name1`, `$name2`
- `disable-model-invocation: true` only on skills with no conditional logic. Omit for skills that branch on filesystem/process state (relay's create/join/end all omit it)
- `${CLAUDE_PLUGIN_ROOT}` in the body resolves to the plugin's installed directory — use it to copy bundled assets

## MCP servers (relay pattern)

- **Zero-dep stdio JSON-RPC is fine** — MCP-over-stdio is just newline-delimited JSON-RPC 2.0. For simple servers, skip `@modelcontextprotocol/sdk` and implement directly with `node:readline` + `process.stdout.write(JSON.stringify(...) + '\n')`. Eliminates `npm install`, `node_modules`, and 10MB+ per runtime copy. See `plugins/relay/server/server.js` for the pattern.
- If you do use the SDK: `@modelcontextprotocol/sdk@^1.0.0`, low-level `Server` + `setRequestHandler(ListToolsRequestSchema, ...)` + `setRequestHandler(CallToolRequestSchema, ...)`. Most version-stable, avoids the zod dependency that `McpServer` requires.
- ESM (`"type": "module"` in package.json)
- Skills copy `server.js` + `package.json` into a per-use runtime dir (e.g. `<CLAUDE_CONFIG_DIR>/relay/<team>/`). **Existing runtime copies don't auto-upgrade** when the plugin updates — call this out in the plugin README.
- For **per-terminal** MCP env vars (e.g. each terminal needs a different `RELAY_NAME`), register via the CLI: `claude mcp add --transport=stdio --env=KEY1=v1 --env=KEY2=v2 <name> -- node <path>`. **Use `--opt=val` form** (with `=`) — the `--env` flag is variadic and will otherwise greedily eat the server name as another env var. The default `--scope local` writes to `~/.claude.json` keyed by the current project path, so two terminals in different project dirs get isolated entries. Note: `mcpServers` in `<cwd>/.claude/settings.local.json` is NOT loaded by Claude Code — that file is for general settings, not MCP. Don't try to write MCP config there.

## Claude Code Channels (push delivery into sessions)

- Declare capability: `experimental: { "claude/channel": {} }` in Server constructor alongside `tools: {}`
- Push a message: `await server.notification({ method: "notifications/claude/channel", params: { content: "...", meta: { key: "val" } } })` — call after `server.connect()`. `meta` keys must be `[a-zA-Z0-9_]+` only — keys with hyphens are silently dropped.
- Start Claude with channels active: `claude --dangerously-load-development-channels server:<mcp-server-name>` — the dangerous flag IS the channels flag for non-allowlisted entries (don't combine with `--channels`; the docs say "combining doesn't extend the bypass"). Approve the confirmation prompt at startup.
- Channels require **claude.ai login** (Pro/Max account or Team/Enterprise). API key auth is not supported.
- Allowlist: only `claude-plugins-official` channels (telegram, discord, imessage, fakechat) are pre-approved. Custom channels need `--dangerously-load-development-channels` until either (a) submitted to and accepted by `anthropics/claude-plugins-official` or (b) added by a Team/Enterprise admin via `allowedChannelPlugins` in managed settings.
- **File watcher pattern (Windows-critical):** use `fs.watchFile(path, { interval: 200 }, cb)` — NOT `fs.watch`. `fs.watch` doesn't fire reliably on Windows for cross-process file content changes (verified empirically — drainInbox never triggered with `fs.watch`). `fs.watchFile` polls and works.
- Server-side debug: `notification returned: undefined` from `server.notification()` is a successful return (the call is fire-and-forget). If notifications don't surface in Claude despite this, the issue is at the client-side allowlist, not the server.

## Validation before committing

- `node --check <path>` for JS syntax
- `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"` for JSON validity
- For MCP servers: spawn once with required env vars (e.g. `RELAY_DIR`, `RELAY_NAME`, `RELAY_TEAM`) and confirm side-effect files (e.g. `members.json`) appear correctly
- Bump `plugin.json` version whenever skills or server.js change — plugin system won't re-download unless the version increments

## Conventions

- Forward-slash absolute paths in JSON config (`C:/Users/...`) — works on both Windows and POSIX
- Lowercase commit messages prefixed by area: `relay: ...`, `squad: ...`, `chore: ...`, `readme: ...`
- Keep README and code changes in separate commits when their scope diverges

## Git push policy

- **Bump `plugin.json` version before every commit that touches a plugin.** Any change to a skill (`SKILL.md`) or server (`server.js`) must increment the version — the plugin system won't re-download otherwise. Do this before staging, not after.
- **Push only after the whole task is done AND verified.** Don't push partial work, don't push between intermediate steps. Verification means: tests run, dry-runs succeed, or the equivalent for the change at hand.
- **Always ask before pushing.** Even when the work is complete, don't `git push` autonomously — commit, then ask the user "ready to push?" and wait for confirmation. Committing is local and reversible; pushing isn't.
