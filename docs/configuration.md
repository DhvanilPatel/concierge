# Local configuration (JSON5)

Concierge reads an optional per-user config from `~/.concierge/config.json`. The file uses JSON5 parsing, so trailing commas and comments are allowed.

## Example (`~/.concierge/config.json`)

```json5
{
  // Default model when no CLI flag is provided
  model: "gpt-5.2-pro",

  notify: {
    enabled: true,          // default notifications (still auto-mutes in CI/SSH unless forced on)
    sound: false,           // play a sound on completion
    muteIn: ["CI", "SSH"], // auto-disable when these env vars are set
  },

  browser: {
    chromeProfile: "Default",
    chromePath: null,
    chromeCookiePath: null,
    chatgptUrl: "https://chatgpt.com/", // root is fine; folder URLs also work
    url: null,              // alias for chatgptUrl (kept for back-compat)
    debugPort: null,        // fixed DevTools port (env: CONCIERGE_BROWSER_PORT / CONCIERGE_BROWSER_DEBUG_PORT)
    timeoutMs: 1200000,
    inputTimeoutMs: 30000,
    cookieSyncWaitMs: 0,    // wait (ms) before retrying cookie sync when Chrome cookies are empty/locked
    modelStrategy: "select", // select | current | ignore (ChatGPT only; ignored for Gemini web)
    thinkingTime: "extended", // light | standard | extended | heavy (ChatGPT Thinking/Pro models)
    manualLogin: false,        // set true to reuse a persistent automation profile and sign in once (Windows defaults to true when unset)
    manualLoginProfileDir: null, // override profile dir (or set CONCIERGE_BROWSER_PROFILE_DIR)
    headless: false,
    hideWindow: false,
    keepBrowser: false,
    manualLoginCookieSync: false, // allow cookie sync even in manual-login mode
  },

  // Default target for `concierge serve` remote browser runs
  remote: {
    host: "192.168.64.2:9473",
    token: "c4e5f9...", // printed by `concierge serve`
  },

  heartbeatSeconds: 30,       // default heartbeat interval
  sessionRetentionHours: 72,  // prune cached sessions older than 72h before each run (0 disables)
  promptSuffix: "// signed-off by me" // appended to every prompt
}
```

## Precedence

CLI flags → `config.json` → environment → built-in defaults.

- `model`, `heartbeatSeconds`, and `promptSuffix` in `config.json` override auto-detected values unless explicitly set on the CLI.
- Remote browser defaults follow the same order: `--remote-host/--remote-token` win, then `remote.host` / `remote.token` (or `remoteHost` / `remoteToken`) in the config, then `CONCIERGE_REMOTE_HOST` / `CONCIERGE_REMOTE_TOKEN` if still unset.
- `CONCIERGE_NOTIFY*` env vars still layer on top of the config’s `notify` block.
- `sessionRetentionHours` controls the default value for `--retain-hours`. When unset, `CONCIERGE_RETAIN_HOURS` (if present) becomes the fallback, and the CLI flag still wins over both.
- `browser.chatgptUrl` accepts either the root ChatGPT URL (`https://chatgpt.com/`) or a folder/workspace URL (e.g., `https://chatgpt.com/g/.../project`); `browser.url` remains as a legacy alias.
- Browser automation defaults can be set under `browser.*`, including `browser.manualLogin`, `browser.manualLoginProfileDir`, and `browser.thinkingTime` (CLI override: `--browser-thinking-time`). On Windows, `browser.manualLogin` defaults to `true` when omitted.

If the config is missing or invalid, Concierge falls back to defaults and prints a warning for parse errors.

Chromium-based browsers usually need both `chromePath` (binary) and `chromeCookiePath` (cookie DB) set so automation can launch the right executable and reuse your login. See [docs/chromium-forks.md](chromium-forks.md) for detailed paths per browser/OS.

## Session retention

Each invocation can optionally prune cached sessions before starting new work:

- `--retain-hours <n>` deletes sessions older than `<n>` hours right before the run begins. Use `0` (or omit the flag) to skip pruning.
- In `config.json`, set `sessionRetentionHours` to apply pruning automatically for every CLI/TUI invocation.
- Set `CONCIERGE_RETAIN_HOURS` in the environment to override the config on shared machines without editing the JSON file.

Under the hood, pruning removes entire session directories (metadata + logs). The command-line cleanup command (`concierge session --clear`) still exists when you need to wipe everything manually.
