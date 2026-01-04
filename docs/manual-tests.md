# Manual Test Suite (Browser Mode)

These checks validate the real Chrome automation path and the Gemini web client. Run the browser steps whenever you touch Chrome automation (lifecycle, cookie sync, prompt injection, Markdown capture, etc.).

## Prerequisites

- macOS with Chrome installed (default profile signed in to ChatGPT Pro).
- Node 22+ and `pnpm install` already completed.
- Headful display access (no `--browser-headless`).
- When debugging, add `--browser-keep-browser` so Chrome stays open after Concierge exits, then connect with `pnpm exec tsx scripts/browser-tools.ts ...` (screenshot, eval, DOM picker, etc.).
- Ensure no Chrome instances are force-terminated mid-run; let Concierge clean up once you’re done capturing state.
- Clipboard checks (`browser-tools.ts eval "navigator.clipboard.readText()"`) trigger a permission dialog in Chrome—approve it for debugging, but remember that we can’t rely on readText in unattended runs.

## Test Cases

### Quick browser port smoke

- `pnpm test:browser` — launches headful Chrome and checks the DevTools endpoint is reachable. Set `CONCIERGE_BROWSER_PORT` (or `CONCIERGE_BROWSER_DEBUG_PORT`) to reuse a fixed port when you’ve already opened a firewall rule.

### Gemini web mode (Gemini web / cookies)

Run this whenever you touch the Gemini web client or the `--generate-image` / `--edit-image` plumbing.

Prereqs:
- Chrome profile is signed into `gemini.google.com`.

1. Generate an image:
   `pnpm run concierge -- --model gemini-3-pro --prompt "a cute robot holding a banana" --generate-image /tmp/gemini-gen.jpg --aspect 1:1 --wait --verbose`
   - Confirm the output file exists and is a real image (`file /tmp/gemini-gen.jpg`).
2. Edit an image:
   `pnpm run concierge -- --model gemini-3-pro --prompt "add sunglasses" --edit-image /tmp/gemini-gen.jpg --output /tmp/gemini-edit.jpg --wait --verbose`
   - Confirm `/tmp/gemini-edit.jpg` exists.

### ChatGPT Images (browser automation)

Run this whenever you touch ChatGPT image generation or image download handling.

1. Generate an image:
   `pnpm run concierge -- --model gpt-5.2-pro --prompt "a neon cyberpunk otter, cinematic lighting" --generate-image /tmp/chatgpt-gen.png --wait --verbose`
   - Confirm the output file exists and is a real image (`file /tmp/chatgpt-gen.png`).

### ChatGPT automation (manual exploration)

Before running any agent-driven debugging, you can rely on the TypeScript CLI in `scripts/browser-tools.ts`:

```bash
# Show help / available commands
pnpm tsx scripts/browser-tools.ts --help

# Launch Chrome with your normal profile so you stay logged in
pnpm tsx scripts/browser-tools.ts start --profile

# Drive the active tab
pnpm tsx scripts/browser-tools.ts nav https://example.com
pnpm tsx scripts/browser-tools.ts eval 'document.title'
pnpm tsx scripts/browser-tools.ts screenshot
pnpm tsx scripts/browser-tools.ts pick "Select checkout button"
pnpm tsx scripts/browser-tools.ts cookies
pnpm tsx scripts/browser-tools.ts inspect   # show DevTools-enabled Chrome PIDs/ports/tabs
pnpm tsx scripts/browser-tools.ts kill --all --force   # tear down straggler DevTools sessions
```

1. **Prompt submission & model switching**
   - With Chrome signed in and cookie sync enabled, run:
     ```bash
     pnpm run concierge -- --model "GPT-5.2" \
       --prompt "Line 1\nLine 2\nLine 3"
     ```
   - Observe logs for:
     - `Prompt textarea ready (xxx chars queued)` (twice: initial + after model switch).
     - `Model picker: ... 5.2 ...`.
     - `Clicked send button` (or Enter fallback).
   - In the attached Chrome window, verify the multi-line prompt appears exactly as sent.

2. **Markdown capture**
   - Prompt:
     ```bash
     pnpm run concierge -- --model "GPT-5.2" \
       --prompt "Produce a short bullet list with code fencing."
     ```
   - Expected CLI output:
     - `Answer:` section containing bullet list with Markdown preserved (e.g., `- item`, fenced code).
     - Session log (`concierge session <id>`) should show the assistant markdown (confirm via `grep -n '```' ~/.concierge/sessions/<id>/output.log`).

3. **Stop button handling**
  - Start a long prompt (`"Write a detailed essay about browsers"`) and once ChatGPT responds, manually click “Stop generating” inside Chrome.
  - Concierge should detect the assistant message (partial) and still store the markdown.

4. **Override flag**
  - Run with `--browser-allow-cookie-errors` while intentionally breaking bindings.
  - Confirm log shows `Cookie sync failed (continuing with override)` and the run proceeds headful/logged-out.

- Remember: the browser composer now pastes only the user prompt (plus any inline file blocks). If you see the default “You are Concierge…” text or other system-prefixed content in the ChatGPT composer, something regressed in `assembleBrowserPrompt` and you should stop and file a bug.
- Heartbeats: browser runs do **not** emit `--heartbeat` logs today; treat heartbeat toggles as no-ops for browser validation.

## Post-Run Validation

- `concierge session <id>` should replay the transcript with markdown.
