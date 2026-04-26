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

- `@modelcontextprotocol/sdk@^1.0.0`, low-level `Server` + `setRequestHandler(ListToolsRequestSchema, ...)` + `setRequestHandler(CallToolRequestSchema, ...)`. Most version-stable, avoids the zod dependency that `McpServer` requires.
- ESM (`"type": "module"` in package.json)
- Skills copy `server.js` + `package.json` into a per-use runtime dir (e.g. `~/.claude/relay/<team>/`) and run `npm install` there. **Existing runtime copies don't auto-upgrade** when the plugin updates — call this out in the plugin README.
- For **per-terminal** MCP env vars (e.g. each terminal needs a different `RELAY_NAME`), write the MCP server registration to **project-local** `<cwd>/.claude/settings.local.json`, not user-global `~/.claude/settings.json`. Global is shared across all running Claude instances on the user account, so writes from one terminal trample another. Project-local files are isolated per CWD.

## Validation before committing

- `node --check <path>` for JS syntax
- `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"` for JSON validity
- For MCP servers: spawn once with required env vars (e.g. `RELAY_DIR`, `RELAY_NAME`, `RELAY_TEAM`) and confirm side-effect files (e.g. `members.json`) appear correctly

## Conventions

- Forward-slash absolute paths in JSON config (`C:/Users/...`) — works on both Windows and POSIX
- Lowercase commit messages prefixed by area: `relay: ...`, `squad: ...`, `chore: ...`, `readme: ...`
- Keep README and code changes in separate commits when their scope diverges

## Git push policy

- **Push only after the whole task is done AND verified.** Don't push partial work, don't push between intermediate steps. Verification means: tests run, dry-runs succeed, or the equivalent for the change at hand.
- **Always ask before pushing.** Even when the work is complete, don't `git push` autonomously — commit, then ask the user "ready to push?" and wait for confirmation. Committing is local and reversible; pushing isn't.
