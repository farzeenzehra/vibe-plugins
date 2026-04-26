# vibe-plugins

Plugins for Claude Code, vibed with Claude.

A small marketplace of plugins built side-by-side with Claude — scratching whatever itch came up that day. New ones land here when they're useful enough to share.

## Add this marketplace

```
/plugin marketplace add farzeenzehra/vibe-plugins
```

Then install whatever you need:

```
/plugin install squad@vibe-plugins
/plugin install relay@vibe-plugins
```

## Plugins

| Plugin | What it does | When to reach for it |
|---|---|---|
| [squad](./plugins/squad) | Spin up a Claude team across terminals using native `TeamCreate` / `SendMessage`. | Starting fresh agents in other projects. The agent terminal opens a brand-new session. |
| [relay](./plugins/relay) | MCP messaging between terminals — preserves each terminal's existing conversation context (one restart, then resume). | You already have rich context in two terminals and want them to talk without losing it. |

Short version: **squad** if you're starting clean, **relay** if you've already been working and don't want to throw it away.

## Updating

To pick up the latest version of any plugin in this marketplace:

```
/plugin marketplace update vibe-plugins
```

Then reinstall the plugin (or use the `/plugin` UI to upgrade in place). See each plugin's README for plugin-specific update notes — `relay` in particular has runtime state in `~/.claude/relay/` that doesn't auto-upgrade with the plugin.

## Repo layout

```
vibe-plugins/
├── .claude-plugin/marketplace.json   ← catalog
├── plugins/
│   ├── squad/                        ← team coordination
│   └── relay/                        ← MCP messaging
└── README.md
```
