# Windows compatibility notes

Keep this in sync as we learn more. Read this before doing browser runs on Windows.

- Browser automation is supported on Windows, but it is flakier than macOS. If it fails, rerun with `--browser-keep-browser` so you can inspect the UI, or use `--remote-chrome` to point at a logged‑in Chrome with remote debugging.
- Cookies: cookie sync is disabled by default on Windows because ChatGPT cookies are app‑bound (`v20`) and can fail decryption. Use `--browser-manual-login` to reuse a persistent automation profile and sign in once (skips cookie copy entirely). Inline cookies remain available (`--browser-inline-cookies(-file)` / `ORACLE_BROWSER_COOKIES_JSON`).
- Manual login flow: run with `--browser-manual-login --browser-keep-browser`, log into chatgpt.com in the opened Chrome, then rerun; the profile lives at `~/.concierge/browser-profile` by default (override with `ORACLE_BROWSER_PROFILE_DIR` or `browser.manualLoginProfileDir` in `~/.concierge/config.json`). If that automation Chrome is already running with remote debugging enabled (DevToolsActivePort present), reuse it instead of relaunching by pointing Concierge at it via `--remote-chrome <host:port>`.
- Cookie paths: preferred path is `%LOCALAPPDATA%\Google\Chrome\User Data\<Profile>\Network\Cookies`. If that errors, try the top-level `Cookies` file or supply the exact path via `--browser-cookie-path`.
- agent-scripts helpers (`runner`, `scripts/committer`) are bash-based and may fail under PowerShell/CMD; run commands directly if they misbehave.
