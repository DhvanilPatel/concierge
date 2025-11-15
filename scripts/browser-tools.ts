#!/usr/bin/env ts-node

/**
 * Minimal Chrome DevTools helpers inspired by Mario Zechner's
 * "What if you don't need MCP?" article.
 *
 * Keeps everything in one TypeScript CLI so agents (or humans) can drive Chrome
 * directly via the DevTools protocol without pulling in a large MCP server.
 */
import { Command } from 'commander';
import { execSync, spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

/** Utility type so TypeScript knows the async function constructor */
type AsyncFunctionCtor = new (...args: string[]) => (...fnArgs: unknown[]) => Promise<unknown>;

const DEFAULT_PORT = 9222;
const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.cache', 'scraping');
const DEFAULT_CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function browserURL(port: number): string {
  return `http://localhost:${port}`;
}

async function connectBrowser(port: number) {
  return puppeteer.connect({ browserURL: browserURL(port), defaultViewport: null });
}

async function getActivePage(port: number) {
  const browser = await connectBrowser(port);
  const pages = await browser.pages();
  const page = pages.at(-1);
  if (!page) {
    await browser.disconnect();
    throw new Error('No active tab found');
  }
  return { browser, page };
}

const program = new Command();
program
  .name('browser-tools')
  .description('Lightweight Chrome DevTools helpers (no MCP required).')
  .configureHelp({ sortSubcommands: true })
  .showSuggestionAfterError();

program
  .command('start')
  .description('Launch Chrome with remote debugging enabled.')
  .option('-p, --port <number>', 'Remote debugging port (default: 9222)', (value) => Number.parseInt(value, 10), DEFAULT_PORT)
  .option('--profile', 'Copy your default Chrome profile before launch.', false)
  .option('--profile-dir <path>', 'Directory for the temporary Chrome profile.', DEFAULT_PROFILE_DIR)
  .option('--chrome-path <path>', 'Path to the Chrome binary.', DEFAULT_CHROME_BIN)
  .action(async (options) => {
    const { port, profile, profileDir, chromePath } = options as {
      port: number;
      profile: boolean;
      profileDir: string;
      chromePath: string;
    };

    try {
      execSync("killall 'Google Chrome'", { stdio: 'ignore' });
    } catch {
      // ignore missing processes
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    execSync(`mkdir -p "${profileDir}"`);
    if (profile) {
      const source = `${path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')}/`;
      execSync(`rsync -a --delete "${source}" "${profileDir}/"`, { stdio: 'ignore' });
    }

    spawn(chromePath, [`--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-popup-blocking'], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    let connected = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const browser = await connectBrowser(port);
        await browser.disconnect();
        connected = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!connected) {
      console.error(`✗ Failed to start Chrome on port ${port}`);
      process.exit(1);
    }
    console.log(`✓ Chrome listening on http://localhost:${port}${profile ? ' (profile copied)' : ''}`);
  });

program
  .command('nav <url>')
  .description('Navigate the current tab or open a new tab.')
  .option('--port <number>', 'Debugger port (default: 9222)', (value) => Number.parseInt(value, 10), DEFAULT_PORT)
  .option('--new', 'Open in a new tab.', false)
  .action(async (url: string, options) => {
    const port = options.port as number;
    const browser = await connectBrowser(port);
    try {
      if (options.new) {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log('✓ Opened in new tab:', url);
      } else {
        const pages = await browser.pages();
        const page = pages.at(-1);
        if (!page) {
          throw new Error('No active tab found');
        }
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log('✓ Navigated current tab to:', url);
      }
    } finally {
      await browser.disconnect();
    }
  });

program
  .command('eval <code...>')
  .description('Evaluate JavaScript in the active page context.')
  .option('--port <number>', 'Debugger port (default: 9222)', (value) => Number.parseInt(value, 10), DEFAULT_PORT)
  .action(async (code: string[], options) => {
    const snippet = code.join(' ');
    const port = options.port as number;
    const { browser, page } = await getActivePage(port);
    try {
      const result = await page.evaluate((body) => {
        const ASYNC_FN = Object.getPrototypeOf(async () => {}).constructor as AsyncFunctionCtor;
        return new ASYNC_FN(`return (${body})`)();
      }, snippet);

      if (Array.isArray(result)) {
        result.forEach((entry, index) => {
          if (index > 0) {
            console.log('');
          }
          Object.entries(entry).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
          });
        });
      } else if (typeof result === 'object' && result !== null) {
        Object.entries(result).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      } else {
        console.log(result);
      }
    } finally {
      await browser.disconnect();
    }
  });

program
  .command('screenshot')
  .description('Capture the current viewport and print the temp PNG path.')
  .option('--port <number>', 'Debugger port (default: 9222)', (value) => Number.parseInt(value, 10), DEFAULT_PORT)
  .action(async (options) => {
    const port = options.port as number;
    const { browser, page } = await getActivePage(port);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(os.tmpdir(), `screenshot-${timestamp}.png`);
      await page.screenshot({ path: filePath });
      console.log(filePath);
    } finally {
      await browser.disconnect();
    }
  });

program
  .command('pick <message...>')
  .description('Interactive DOM picker that prints metadata for clicked elements.')
  .option('--port <number>', 'Debugger port (default: 9222)', (value) => Number.parseInt(value, 10), DEFAULT_PORT)
  .action(async (messageParts: string[], options) => {
    const message = messageParts.join(' ');
    const port = options.port as number;
    const { browser, page } = await getActivePage(port);
    try {
      await page.evaluate(() => {
        const scope = globalThis as typeof globalThis & {
          pickOverlayInjected?: boolean;
          pick?: (prompt: string) => Promise<unknown>;
        };
        if (scope.pickOverlayInjected) {
          return;
        }
        scope.pickOverlayInjected = true;
        scope.pick = async (prompt: string) =>
          new Promise((resolve) => {
            const selections: unknown[] = [];
            const selectedElements = new Set<HTMLElement>();

            const overlay = document.createElement('div');
            overlay.style.cssText =
              'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none';

            const highlight = document.createElement('div');
            highlight.style.cssText =
              'position:absolute;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);transition:all 0.05s ease';
            overlay.appendChild(highlight);

            const banner = document.createElement('div');
            banner.style.cssText =
              'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:12px 24px;border-radius:8px;font:14px system-ui;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:auto;z-index:2147483647';

            const updateBanner = () => {
              banner.textContent = `${prompt} (${selections.length} selected, Cmd/Ctrl+click to add, Enter to finish, ESC to cancel)`;
            };

            const cleanup = () => {
              document.removeEventListener('mousemove', onMove, true);
              document.removeEventListener('click', onClick, true);
              document.removeEventListener('keydown', onKey, true);
              overlay.remove();
              banner.remove();
              selectedElements.forEach((el) => {
                el.style.outline = '';
              });
            };

            const serialize = (el: HTMLElement) => {
              const parents: string[] = [];
              let current = el.parentElement;
              while (current && current !== document.body) {
                const id = current.id ? `#${current.id}` : '';
                const cls = current.className ? `.${current.className.trim().split(/\s+/).join('.')}` : '';
                parents.push(`${current.tagName.toLowerCase()}${id}${cls}`);
                current = current.parentElement;
              }
              return {
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                class: el.className || null,
                text: el.textContent?.trim()?.slice(0, 200) || null,
                html: el.outerHTML.slice(0, 500),
                parents: parents.join(' > '),
              };
            };

            const onMove = (event: MouseEvent) => {
              const node = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
              if (!node || overlay.contains(node) || banner.contains(node)) return;
              const rect = node.getBoundingClientRect();
              highlight.style.cssText = `position:absolute;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px`;
            };
            const onClick = (event: MouseEvent) => {
              if (banner.contains(event.target as Node)) return;
              event.preventDefault();
              event.stopPropagation();
              const node = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
              if (!node || overlay.contains(node) || banner.contains(node)) return;

              if (event.metaKey || event.ctrlKey) {
                if (!selectedElements.has(node)) {
                  selectedElements.add(node);
                  node.style.outline = '3px solid #10b981';
                  selections.push(serialize(node));
                  updateBanner();
                }
              } else {
                cleanup();
                const info = serialize(node);
                resolve(selections.length > 0 ? selections : info);
              }
            };

            const onKey = (event: KeyboardEvent) => {
              if (event.key === 'Escape') {
                cleanup();
                resolve(null);
              } else if (event.key === 'Enter' && selections.length > 0) {
                cleanup();
                resolve(selections);
              }
            };

            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('click', onClick, true);
            document.addEventListener('keydown', onKey, true);

            document.body.append(overlay, banner);
            updateBanner();
          });
      });

      const result = await page.evaluate((msg) => {
        const pickFn = (window as Window & { pick?: (message: string) => Promise<unknown> }).pick;
        if (!pickFn) {
          return null;
        }
        return pickFn(msg);
      }, message);

      if (Array.isArray(result)) {
        result.forEach((entry, index) => {
          if (index > 0) {
            console.log('');
          }
          Object.entries(entry).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
          });
        });
      } else if (result && typeof result === 'object') {
        Object.entries(result).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      } else {
        console.log(result);
      }
    } finally {
      await browser.disconnect();
    }
  });

program
  .command('cookies')
  .description('Dump cookies from the active tab as JSON.')
  .option('--port <number>', 'Debugger port (default: 9222)', (value) => Number.parseInt(value, 10), DEFAULT_PORT)
  .action(async (options) => {
    const port = options.port as number;
    const { browser, page } = await getActivePage(port);
    try {
      const cookies = await page.cookies();
      console.log(JSON.stringify(cookies, null, 2));
    } finally {
      await browser.disconnect();
    }
  });

program.parseAsync(process.argv);
