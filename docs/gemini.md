# Gemini Web Integration

Concierge supports Gemini through a cookie-based client for `gemini.google.com`. This path does **not** use API keys and does **not** drive ChatGPT.

## Usage (Gemini web / cookies)

Prereqs:
- Chrome installed.
- Signed into `gemini.google.com` in the Chrome profile Concierge uses (default: `Default`).

Examples:
```bash
# Text run
concierge --model gemini-3-pro --prompt "Say OK."

# Generate an image (writes an output file)
concierge --model gemini-3-pro \
  --prompt "a cute robot holding a banana" \
  --generate-image out.jpg --aspect 1:1

# Edit an image (input via --edit-image, output via --output)
concierge --model gemini-3-pro \
  --prompt "add sunglasses" \
  --edit-image in.png --output out.jpg

# YouTube analysis
concierge --model gemini-3-pro \
  --prompt "Summarize the key claims" \
  --youtube "https://www.youtube.com/watch?v=..."
```

Notes:
- If your logged-in Gemini account can’t access “Pro”, Concierge auto-falls back to a supported model for web runs (and logs the fallback in verbose mode).
- This path runs fully in Node/TypeScript (no Python/venv dependency).
- `--browser-model-strategy` only affects ChatGPT automation; Gemini web always uses the explicit Gemini model ID.

## Implementation details

- `src/gemini-web/client.ts` — talks to `gemini.google.com` and downloads generated images via authenticated redirects.
- `src/gemini-web/executor.ts` — Gemini web executor (loads Chrome cookies and runs the web client).

## Testing

- Unit/regression: `pnpm vitest run tests/gemini-web`
- Live (Gemini web/cookies): `CONCIERGE_LIVE_TEST=1 pnpm vitest run tests/live/gemini-web-live.test.ts`
