# trmnl-agent-usage

Show your coding agent usage and rate limits on a [TRMNL](https://usetrmnl.com) e-ink display.

Fetches usage data from **Claude Code**, **OpenAI Codex**, and **Gemini CLI**, then pushes it to a TRMNL private plugin webhook for rendering on the 800x480 e-ink screen.

![TRMNL Display](https://github.com/user-attachments/assets/placeholder.png)

## Features

- **Claude Code** — Session (5h) and weekly (7d) rate limits, extra usage spend
- **OpenAI Codex** — Primary and secondary rate limit windows, credit balance
- **Gemini CLI** — Pro and Flash model quota usage
- **Zero npm dependencies** — uses Bun built-ins only
- **Auto-refresh** via macOS launchd (every 8 minutes)

## Prerequisites

- [Bun](https://bun.sh) runtime
- A [TRMNL](https://usetrmnl.com) device
- At least one of: Claude Code, OpenAI Codex, or Gemini CLI installed and authenticated

## Setup

### 1. Create a TRMNL Private Plugin

1. Go to [usetrmnl.com](https://usetrmnl.com) → Plugins → Private Plugin → New
2. Name: `Agent Usage`, Strategy: **Webhook** → Save
3. Copy the **Webhook UUID** from the plugin settings
4. Click **Edit Markup** → paste contents of [`template/plugin.html`](template/plugin.html) → Save

### 2. Configure

```bash
git clone https://github.com/jakedefayette/trmnl-agent-usage.git
cd trmnl-agent-usage
bun install
cp .env.example .env
```

Edit `.env`:

```
TRMNL_WEBHOOK_UUID=your-uuid-here
TRMNL_API_KEY=your-api-key-here
```

### 3. Run

```bash
bun run src/index.ts
```

### 4. Schedule (macOS)

```bash
# Edit the plist with your paths
sed -e "s|__BUN_PATH__|$(which bun)|" \
    -e "s|__BUN_DIR__|$(dirname $(which bun))|" \
    -e "s|__PROJECT_PATH__|$(pwd)|" \
    -e "s|__HOME__|$HOME|" \
    launchd/com.trmnl.agent-usage.plist > ~/Library/LaunchAgents/com.trmnl.agent-usage.plist

launchctl load ~/Library/LaunchAgents/com.trmnl.agent-usage.plist
```

Check logs:

```bash
tail -f ~/Library/Logs/trmnl-agent-usage.log
```

To stop:

```bash
launchctl unload ~/Library/LaunchAgents/com.trmnl.agent-usage.plist
```

## Provider Details

| Provider | Credential Source | API |
|---|---|---|
| Claude Code | `~/.claude/.credentials.json` (or macOS keychain) | `GET /api/oauth/usage` |
| OpenAI Codex | `~/.codex/auth.json` | `GET /backend-api/wham/usage` |
| Gemini CLI | `~/.gemini/oauth_creds.json` + OAuth client from CLI binary | `POST /v1internal:retrieveUserQuota` |

Providers that aren't installed or authenticated are gracefully skipped and shown as unavailable on the display.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `TRMNL_WEBHOOK_UUID` | Yes | From TRMNL private plugin settings |
| `TRMNL_API_KEY` | Yes | From TRMNL account settings |
| `GEMINI_OAUTH_CLIENT_ID` | No | Fallback if CLI binary extraction fails |
| `GEMINI_OAUTH_CLIENT_SECRET` | No | Fallback if CLI binary extraction fails |

## Project Structure

```
src/
├── index.ts              # Entry point
├── config.ts             # Environment config
├── types.ts              # TypeScript interfaces
├── normalizer.ts         # ProviderData → template variables
├── poster.ts             # POST to TRMNL webhook
├── logger.ts             # Stderr logger
├── providers/
│   ├── base.ts           # ProviderFetcher interface
│   ├── claude.ts         # Claude Code provider
│   ├── codex.ts          # OpenAI Codex provider
│   └── gemini.ts         # Gemini CLI provider
└── lib/
    ├── http.ts           # fetch with timeout
    ├── jwt.ts            # JWT decoder
    └── keychain.ts       # macOS keychain reader
template/
└── plugin.html           # TRMNL Liquid template
launchd/
└── com.trmnl.agent-usage.plist  # macOS scheduler template
```

## License

MIT
