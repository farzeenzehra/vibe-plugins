# squad

Coordinate Claude Code agents across multiple project terminals.

## Skills

| Skill | Description |
|---|---|
| `/squad:new-team <team-name>` | Create a team and enable agent teams in settings |
| `/squad:connect <team-name> <agent-name>` | Generate the join command to paste in the agent terminal |
| `/squad:end-team <team-name>` | Delete a team (required before creating a new one) |

## Usage

**Step 1 — In your lead terminal (e.g. backend project):**
```
/squad:new-team my-team
```
Creates the team, enables the required env var in `~/.claude/settings.json`, prints the lead session ID.

**Step 2 — Still in the lead terminal, generate the join command:**
```
/squad:connect my-team fe-agent
```
Prints ready-to-paste commands in Bash, PowerShell, and CMD.

**Step 3 — In the agent terminal (e.g. frontend project):**
Paste and run the printed command. The agent starts pre-connected to the team.

## Installation

```
/plugin marketplace add farzeenzehra/vibe-plugins
/plugin install squad@vibe-plugins
```
