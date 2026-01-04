# concierge 🛎️ — Your AI concierge for the best models

<p align="center">
  <img src="./README-header.png" alt="Concierge CLI header banner" width="1100">
</p>

<p align="center">
  <a href="https://github.com/DhvanilPatel/concierge"><img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=for-the-badge" alt="Platforms"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License"></a>
</p>

Concierge bundles your prompt and files so another AI can answer with real context. It speaks GPT-5.1 Pro (default alias to GPT-5.2 Pro on the API), GPT-5.1 Codex (API-only), GPT-5.1, GPT-5.2, Gemini 3 Pro, Claude Sonnet 4.5, Claude Opus 4.1, and more—and it can ask one or multiple models in a single run. Browser automation is available; use `--browser-model-strategy current` to keep the active ChatGPT model (or `ignore` to skip the picker). API remains the most reliable path, and `--copy` is an easy manual fallback.

*Forked from [Oracle](https://github.com/steipete/oracle) with improvements to browser session cleanup and multi-modal support.*

## Quick start

Clone and build:
```bash
git clone https://github.com/DhvanilPatel/concierge.git
cd concierge
pnpm install
pnpm run build
```

Or link globally: `pnpm link --global`

Requires Node 22+.

```bash
# Copy the bundle and paste into ChatGPT
concierge --render --copy -p "Review the TS data layer for schema drift" --file "src/**/*.ts,*/*.test.ts"

# Minimal API run (expects OPENAI_API_KEY in your env)
concierge -p "Write a concise architecture note for the storage adapters" --file src/storage/README.md

# Multi-model API run
concierge -p "Cross-check the data layer assumptions" --models gpt-5.1-pro,gemini-3-pro --file "src/**/*.ts"

# Preview without spending tokens
concierge --dry-run summary -p "Check release notes" --file docs/release-notes.md

# Browser run (no API key, will open ChatGPT)
concierge --engine browser -p "Walk through the UI smoke test" --file "src/**/*.ts"

# Gemini browser mode (no API key; uses Chrome cookies from gemini.google.com)
concierge --engine browser --model gemini-3-pro --prompt "a cute robot holding a banana" --generate-image out.jpg --aspect 1:1

# Sessions (list and replay)
concierge status --hours 72
concierge session <id> --render

# TUI (interactive, only for humans)
concierge tui
```

Engine auto-picks API when `OPENAI_API_KEY` is set, otherwise browser; browser is stable on macOS and works on Linux and Windows. On Linux pass `--browser-chrome-path/--browser-cookie-path` if detection fails; on Windows prefer `--browser-manual-login` or inline cookies if decryption is blocked.

## Integration

**CLI**
- API mode expects API keys in your environment: `OPENAI_API_KEY` (GPT-5.x), `GEMINI_API_KEY` (Gemini 3 Pro), `ANTHROPIC_API_KEY` (Claude Sonnet 4.5 / Opus 4.1).
- Gemini browser mode uses Chrome cookies instead of an API key—just be logged into `gemini.google.com` in Chrome (no Python/venv required).
- If your Gemini account can't access "Pro", Concierge auto-falls back to a supported model for web runs (and logs the fallback in verbose mode).
- Prefer API mode or `--copy` + manual paste; browser automation is experimental.
- Browser support: stable on macOS; works on Linux (add `--browser-chrome-path/--browser-cookie-path` when needed) and Windows (manual-login or inline cookies recommended when app-bound cookies block decryption).
- Remote browser service: `concierge serve` on a signed-in host; clients use `--remote-host/--remote-token`.

**MCP** (Model Context Protocol)
- `concierge-mcp` is a minimal MCP stdio server that mirrors the Concierge CLI. It shares session storage with the CLI (`~/.concierge/sessions` or `CONCIERGE_HOME_DIR`).

## Configuration

Concierge reads an optional per-user config from `~/.concierge/config.json`. The file uses JSON5 parsing, so trailing commas and comments are allowed.

Environment variables:
- `CONCIERGE_HOME_DIR` — override the default `~/.concierge` directory
- `OPENAI_API_KEY` — for GPT models
- `GEMINI_API_KEY` — for Gemini models
- `ANTHROPIC_API_KEY` — for Claude models

## Key differences from Oracle

- **Renamed**: `oracle` → `concierge`, `~/.oracle` → `~/.concierge`
- **Improved browser cleanup** (in progress): Better process supervision, session state management
- **Multi-modal support** (planned): Image, video, and audio generation through browser automation

## License

MIT — see [LICENSE](LICENSE).
