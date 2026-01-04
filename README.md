# concierge 🛎️ — Your AI concierge for the best models

> **Fork notice:** This is a fork of [@steipete/oracle](https://github.com/steipete/oracle) by Peter Steinberger. I’m grateful for the original work; this fork exists to experiment, simplify, and make the CLI more compact. If you want the canonical upstream, please use the original repo.

<p align="center">
  <img src="./README-header.png" alt="Concierge CLI header banner" width="1100">
</p>

<p align="center">
  <a href="https://github.com/DhvanilPatel/concierge"><img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=for-the-badge" alt="Platforms"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License"></a>
</p>

Concierge bundles your prompt and files so another AI can answer with real context. It drives ChatGPT in your browser (GPT‑5.2 variants), including ChatGPT Images for `--generate-image`, and can optionally use the Gemini web client for image work. No API keys required; use `--copy` for manual paste or `--render` to preview the bundle before you run.

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
# Build the bundle, print it, and copy for manual paste into ChatGPT
concierge --render --copy -p "Review the TS data layer for schema drift" --file "src/**/*.ts,*/*.test.ts"

# Browser run (opens ChatGPT)
concierge -p "Walk through the UI smoke test" --file "src/**/*.ts"

# Target a specific ChatGPT model label
concierge --model gpt-5.2-thinking -p "Summarize this diff" --file "src/**/*.ts"

# Preview without launching Chrome
concierge --dry-run summary -p "Check release notes" --file docs/release-notes.md

# ChatGPT Images (browser automation)
concierge --model gpt-5.2-pro --prompt "a neon cyberpunk otter, cinematic lighting" --generate-image out.png

# Gemini web mode (cookies from gemini.google.com)
concierge --model gemini-3-pro --prompt "a cute robot holding a banana" --generate-image out.jpg --aspect 1:1

# Sessions (list and replay)
concierge status --hours 72
concierge session <id> --render

# TUI (interactive, only for humans)
concierge tui
```

## Integration

**CLI**
- Concierge runs in browser mode only. ChatGPT automation uses your Chrome cookies; Gemini web uses cookies from `gemini.google.com`.
- Browser support: stable on macOS; works on Linux (add `--browser-chrome-path/--browser-cookie-path` when needed) and Windows (manual-login or inline cookies recommended when app-bound cookies block decryption).
- Remote browser service: run `concierge serve` on a signed-in host; clients use `--remote-host/--remote-token`.

## Configuration

Concierge reads an optional per-user config from `~/.concierge/config.json`. The file uses JSON5 parsing, so trailing commas and comments are allowed.

Environment variables:
- `CONCIERGE_HOME_DIR` — override the default `~/.concierge` directory

## Highlights

- **Browser-only**: API clients and multi-model runs have been removed for a smaller, clearer CLI
- **Improved browser cleanup** (in progress): Better process supervision, session state management
- **Multi-modal support** (in progress): Image generation via ChatGPT Images / Gemini web; video and audio are planned

## License

MIT — see [LICENSE](LICENSE).
