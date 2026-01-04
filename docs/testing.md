# Testing quickstart

- Unit/type tests: `pnpm test` (Vitest) and `pnpm run check` (typecheck).
- Browser smokes: `pnpm test:browser` (builds, checks DevTools port 45871, then runs headful browser smokes with GPT‑5.2 for most cases and GPT‑5.2 Pro for the reattach + markdown checks). Requires a signed‑in Chrome profile; runs headful but hides the window by default unless Chrome forces focus.
- Live browser smokes: `ORACLE_LIVE_TEST=1 pnpm test:live` (runs the live browser suite; expect real ChatGPT usage).
- Gemini web (cookie) live smoke: `ORACLE_LIVE_TEST=1 pnpm vitest run tests/live/gemini-web-live.test.ts` (requires a signed‑in Chrome profile at `gemini.google.com`).
- If browser DevTools is blocked on WSL, allow the chosen port (`ORACLE_BROWSER_PORT`/`ORACLE_BROWSER_DEBUG_PORT`, defaults to 45871); see `scripts/test-browser.ts` output for firewall hints.
