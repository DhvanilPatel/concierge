# Concierge TODO

## Completed

- [x] Fork Oracle → Concierge
- [x] Rename package to `concierge-ai` v0.9.0
- [x] Update bin: `concierge` (removed `concierge-mcp`)
- [x] Update CLI branding and help text
- [x] Home dir: `~/.concierge` (env: `CONCIERGE_HOME_DIR`)
- [x] Update all user-facing strings (Oracle → Concierge)
- [x] Remove MCP server (~570 LOC removed)
- [x] Create Concierge skill at `/Users/chip/clawd/skills/concierge/`
- [x] Remove API client code + dependencies (browser-only build)

## Pending - Browser Cleanup Fixes

### 1. Process Supervision (Critical)

**Problem:** Chrome is only killed when `!connectionClosedUnexpectedly`. When connection closes unexpectedly, kill is skipped.

**File:** `src/browser/index.ts` (lines 652-660)

```javascript
// Current (broken):
if (!connectionClosedUnexpectedly) {
    await chrome.kill();  // Only kills if connection was clean
}

// Fix: Always attempt kill, regardless of connection state
```

**File:** `src/browser/chromeLifecycle.ts` (lines 37-96)

### 2. Session State Machine (Critical)

**Problem:** Sessions have `status: "running"` AND `errorMessage` simultaneously - impossible state.

**File:** `src/cli/sessionRunner.ts` (lines 319-339)

```javascript
// Current (broken): When Chrome disconnects, status stays "running"
await sessionStore.updateSession(sessionMeta.id, {
    status: 'running',  // Should be 'error' or 'disconnected'
    errorMessage: message,
});

// Fix: Never have running + errorMessage. Use proper states:
// - 'running' - actively processing
// - 'completed' - finished successfully
// - 'error' - failed
// - 'disconnected' - Chrome died, can reattach
```

### 3. Session Reaper (Important)

**Problem:** No automatic cleanup of stale sessions.

**Solution:** Add a reaper that runs on CLI startup:
1. Check all "running" sessions
2. Verify if `browser.runtime.chromePid` is alive
3. If dead, update status to 'error' or 'orphaned'
4. Optionally auto-delete sessions older than N days

**File to create:** `src/cli/sessionReaper.ts`

```typescript
export async function reapStaleSessions(): Promise<void> {
  const sessions = await sessionStore.listSessions();
  for (const session of sessions) {
    if (session.status === 'running' && session.browser?.runtime?.chromePid) {
      const alive = isProcessAlive(session.browser.runtime.chromePid);
      if (!alive) {
        await sessionStore.updateSession(session.id, {
          status: 'orphaned',
          errorMessage: 'Chrome process died unexpectedly',
        });
      }
    }
  }
}
```

### 4. Concurrent Session Limit (Nice to have)

**Problem:** Multiple Concierge instances spawn simultaneously without queue/lock.

**Solution:** Add a semaphore or lock file to limit concurrent browser sessions.

## Future - Multi-Modal Support

Vision: Universal AI browser automation for any web-based AI service.

**Providers to add:**
- Image: Midjourney, Ideogram, Leonardo, Flux
- Video: Sora, Runway, Pika, Kling, Minimax
- Audio: Suno, Udio
- Research: NotebookLM, Perplexity Pro

**Architecture:**
```
concierge --provider chatgpt -p "explain X"
concierge --provider midjourney -p "a cat in space" --output cat.png
concierge --provider sora -p "a cat walking" --output cat.mp4
```

Each provider defines:
- URL & auth flow
- Input method (text box, upload, etc.)
- Completion detection
- Result extraction/download

## Investigation Notes

### Root Cause of Zombie Chrome Windows

From session analysis on 2026-01-04:
- 37 sessions marked "running" but only 2 concierge processes alive
- 10 Chrome PIDs recorded as "running" but processes dead
- 20 "what-is-2-2-reply-*" test sessions in 44 minutes (Clawdis retry loop)

**Key code locations:**
- `/opt/homebrew/lib/node_modules/@steipete/oracle/dist/src/browser/chromeLifecycle.js` (lines 37-96)
- `/opt/homebrew/lib/node_modules/@steipete/oracle/dist/src/browser/index.js` (lines 641-682)
- `/opt/homebrew/lib/node_modules/@steipete/oracle/dist/src/cli/sessionRunner.js` (lines 319-339)
