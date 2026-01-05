import type { ChromeClient, BrowserLogger } from '../types.js';
import { ASSISTANT_ROLE_SELECTOR, CONVERSATION_TURN_SELECTOR } from '../constants.js';
import { delay } from '../utils.js';

export type AssistantImageSnapshot = { urls: string[]; count: number };

export async function readAssistantImageSnapshot(
  Runtime: ChromeClient['Runtime'],
  minTurnIndex?: number,
): Promise<AssistantImageSnapshot> {
  const expression = buildAssistantImageExpression(minTurnIndex);
  const { result } = await Runtime.evaluate({ expression, returnByValue: true });
  const value = result?.value as { urls?: unknown; count?: unknown } | undefined;
  const rawUrls = Array.isArray(value?.urls) ? value?.urls.filter((url) => typeof url === 'string') : [];
  const contentUrls = rawUrls.filter(
    (url) => url.includes('/backend-api/estuary/content') || url.includes('p=fs'),
  );
  const blobUrls = rawUrls.filter((url) => url.startsWith('blob:') || url.startsWith('data:image/'));
  const urls = contentUrls.length > 0 ? contentUrls : blobUrls.length > 0 ? blobUrls : rawUrls;
  return { urls, count: urls.length };
}

export async function clickAssistantImageDownload(
  Runtime: ChromeClient['Runtime'],
  logger: BrowserLogger,
  minTurnIndex?: number,
  preferredUrl?: string,
): Promise<boolean> {
  const expression = buildAssistantImageDownloadExpression(minTurnIndex, preferredUrl);
  const { result } = await Runtime.evaluate({ expression, returnByValue: true });
  const value = result?.value as { clicked?: boolean; reason?: string } | undefined;
  if (!value?.clicked && logger?.verbose && value?.reason) {
    logger(`[browser] Download button not clicked (${value.reason})`);
  }
  return Boolean(value?.clicked);
}

export async function waitForAssistantImages(
  Runtime: ChromeClient['Runtime'],
  timeoutMs: number,
  logger: BrowserLogger,
  minTurnIndex?: number,
): Promise<AssistantImageSnapshot> {
  logger('Waiting for generated images');
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let lastCount = 0;
  let lastSignature = '';
  let stableCycles = 0;
  let best: AssistantImageSnapshot | null = null;
  while (Date.now() < deadline) {
    const snapshot = await readAssistantImageSnapshot(Runtime, minTurnIndex).catch(() => null);
    if (snapshot && snapshot.urls.length > 0) {
      best = snapshot;
      const signature = snapshot.urls.slice().sort().join('|');
      if (snapshot.urls.length === lastCount && signature === lastSignature) {
        stableCycles += 1;
      } else {
        stableCycles = 0;
        lastCount = snapshot.urls.length;
        lastSignature = signature;
      }
      if (stableCycles >= 2) {
        return snapshot;
      }
    } else {
      stableCycles = 0;
      lastCount = 0;
      lastSignature = '';
    }
    await delay(1000);
  }
  return best ?? { urls: [], count: 0 };
}

function buildAssistantImageDownloadExpression(minTurnIndex?: number, preferredUrl?: string): string {
  const minTurnLiteral =
    typeof minTurnIndex === 'number' && Number.isFinite(minTurnIndex) && minTurnIndex >= 0
      ? Math.floor(minTurnIndex)
      : -1;
  const preferredLiteral = preferredUrl ? JSON.stringify(preferredUrl) : 'null';
  const conversationLiteral = JSON.stringify(CONVERSATION_TURN_SELECTOR);
  const assistantLiteral = JSON.stringify(ASSISTANT_ROLE_SELECTOR);
  return `(() => {
    const MIN_TURN_INDEX = ${minTurnLiteral};
    const PREFERRED_URL = ${preferredLiteral};
    const CONVERSATION_SELECTOR = ${conversationLiteral};
    const ASSISTANT_SELECTOR = ${assistantLiteral};
    const isAssistantTurn = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const turnAttr = (node.getAttribute('data-turn') || node.dataset?.turn || '').toLowerCase();
      if (turnAttr === 'assistant') return true;
      const role = (node.getAttribute('data-message-author-role') || node.dataset?.messageAuthorRole || '').toLowerCase();
      if (role === 'assistant') return true;
      const testId = (node.getAttribute('data-testid') || '').toLowerCase();
      if (testId.includes('assistant')) return true;
      return Boolean(node.querySelector(ASSISTANT_SELECTOR) || node.querySelector('[data-testid*="assistant"]'));
    };
    const turns = Array.from(document.querySelectorAll(CONVERSATION_SELECTOR));
    const hasTurns = turns.length > 0;
    let scope = null;
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (MIN_TURN_INDEX >= 0 && i < MIN_TURN_INDEX) break;
      const turn = turns[i];
      if (isAssistantTurn(turn)) {
        scope = turn;
        break;
      }
    }
    if (!scope) {
      if (!hasTurns || MIN_TURN_INDEX < 0) {
        scope = document.querySelector('main') || document.body;
      } else {
        return { clicked: false, reason: 'no-assistant-scope' };
      }
    }
    const isVisible = (node, opts = {}) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const display = (style.display || '').toLowerCase();
      const visibility = (style.visibility || '').toLowerCase();
      const opacity = Number.parseFloat(style.opacity || '1');
      if (display === 'none' || visibility === 'hidden') return false;
      if (!opts.ignoreOpacity && Number.isFinite(opacity) && opacity < 0.5) return false;
      return true;
    };
    const readImgUrl = (img) => {
      return (
        img.currentSrc ||
        img.src ||
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-lazy-src') ||
        ''
      );
    };
    const getImageKey = (url) => {
      if (!url) return '';
      try {
        const parsed = new URL(url, location.href);
        return parsed.searchParams.get('id') || parsed.pathname || url;
      } catch {
        return url;
      }
    };
    const matchesPreferred = (url) => {
      if (!PREFERRED_URL) return false;
      const preferredKey = getImageKey(PREFERRED_URL);
      if (!preferredKey) return false;
      return getImageKey(url) === preferredKey || url === PREFERRED_URL;
    };
    const isLikelyImageUrl = (url, altText) => {
      if (!url) return false;
      if (altText && altText.toLowerCase().includes('generated')) return true;
      if (url.startsWith('data:image/')) return true;
      if (url.startsWith('blob:')) return true;
      if (/\\.(png|jpe?g|webp|gif)(\\?|$)/i.test(url)) return true;
      return /oaidalle|dalle|openai|image|estuary/i.test(url);
    };
    const candidates = [];
    for (const img of Array.from(scope.querySelectorAll('img'))) {
      const url = readImgUrl(img);
      const alt = (img.getAttribute('alt') || '').trim();
      const style = getComputedStyle(img);
      const filter = (style.filter || '').toLowerCase();
      const opacity = Number.parseFloat(style.opacity || '1');
      if (filter.includes('blur(')) continue;
      if (Number.isFinite(opacity) && opacity < 0.5) continue;
      if (!isVisible(img)) continue;
      if (!isLikelyImageUrl(url, alt)) continue;
      candidates.push({ img, url });
    }
    let target = null;
    if (PREFERRED_URL) {
      target = candidates.find((entry) => matchesPreferred(entry.url)) || null;
      if (!target) {
        return { clicked: false, reason: 'preferred-image-not-found' };
      }
    }
    if (!target && candidates.length > 0) {
      target = candidates[candidates.length - 1];
    }
    const DOWNLOAD_SELECTOR =
      'button[aria-label*="Download"], button[aria-label*="download"], button[aria-label*="Save"], button[aria-label*="save"], a[download], a[aria-label*="Download"], a[aria-label*="download"]';
    const revealHover = (node) => {
      if (!(node instanceof HTMLElement)) return;
      const rect = node.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const events = ['mouseover', 'mouseenter', 'mousemove'];
      for (const type of events) {
        node.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }));
      }
    };
    const findDownloadButton = (img) => {
      const container =
        img.closest('[id^="image-"]') ||
        img.closest('[class*="imagegen"]') ||
        img.closest('[data-testid]') ||
        img.closest('article') ||
        img.closest('section') ||
        img.parentElement;
      if (!container) return null;
      const buttons = Array.from(container.querySelectorAll(DOWNLOAD_SELECTOR));
      return buttons.find((btn) => isVisible(btn, { ignoreOpacity: true })) || buttons[0] || null;
    };
    let button = null;
    if (target) {
      revealHover(target.img);
      const container = target.img.closest('[data-testid]') || target.img.closest('article') || target.img.closest('section') || target.img.parentElement;
      if (container) {
        revealHover(container);
      }
      button = findDownloadButton(target.img);
    }
    if (!button) {
      const buttons = Array.from(document.querySelectorAll(DOWNLOAD_SELECTOR));
      button = buttons.find((btn) => isVisible(btn, { ignoreOpacity: true })) || buttons[0] || null;
    }
    if (!button) {
      return { clicked: false, reason: 'no-download-button' };
    }
    if (button instanceof HTMLElement) {
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
    }
    button.click();
    return { clicked: true };
  })()`;
}

function buildAssistantImageExpression(minTurnIndex?: number): string {
  const minTurnLiteral =
    typeof minTurnIndex === 'number' && Number.isFinite(minTurnIndex) && minTurnIndex >= 0
      ? Math.floor(minTurnIndex)
      : -1;
  const conversationLiteral = JSON.stringify(CONVERSATION_TURN_SELECTOR);
  const assistantLiteral = JSON.stringify(ASSISTANT_ROLE_SELECTOR);
  return `(() => {
    const MIN_TURN_INDEX = ${minTurnLiteral};
    const CONVERSATION_SELECTOR = ${conversationLiteral};
    const ASSISTANT_SELECTOR = ${assistantLiteral};
    const isAssistantTurn = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const turnAttr = (node.getAttribute('data-turn') || node.dataset?.turn || '').toLowerCase();
      if (turnAttr === 'assistant') return true;
      const role = (node.getAttribute('data-message-author-role') || node.dataset?.messageAuthorRole || '').toLowerCase();
      if (role === 'assistant') return true;
      const testId = (node.getAttribute('data-testid') || '').toLowerCase();
      if (testId.includes('assistant')) return true;
      return Boolean(node.querySelector(ASSISTANT_SELECTOR) || node.querySelector('[data-testid*="assistant"]'));
    };
    const turns = Array.from(document.querySelectorAll(CONVERSATION_SELECTOR));
    const hasTurns = turns.length > 0;
    let scope = null;
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (MIN_TURN_INDEX >= 0 && i < MIN_TURN_INDEX) break;
      const turn = turns[i];
      if (isAssistantTurn(turn)) {
        scope = turn;
        break;
      }
    }
    if (!scope) {
      if (!hasTurns || MIN_TURN_INDEX < 0) {
        scope = document.querySelector('main') || document.body;
      } else {
        return { urls: [], count: 0 };
      }
    }
    const urls = [];
    const scores = new Map();
    const minSize = 96;
    const minArea = 10_000;
    const isLikelyImageUrl = (url, altText) => {
      if (!url) return false;
      if (altText && altText.toLowerCase().includes('generated')) return true;
      if (url.startsWith('data:image/')) return true;
      if (url.startsWith('blob:')) return true;
      if (/\\.(png|jpe?g|webp|gif)(\\?|$)/i.test(url)) return true;
      return /oaidalle|dalle|openai|image|estuary/i.test(url);
    };
    const scoreImage = (url, altText, width, height) => {
      let score = 0;
      const alt = (altText || '').toLowerCase();
      if (alt.includes('generated')) score += 6;
      if (url.startsWith('blob:') || url.startsWith('data:image/')) score += 4;
      if (url.includes('/backend-api/estuary/content')) score += 4;
      if (url.includes('p=fs')) score += 2;
      if (url.includes('public_content')) score -= 1;
      const w = Number(width) || 0;
      const h = Number(height) || 0;
      if (w >= 512 && h >= 512) score += 1;
      return score;
    };
    const shouldKeep = (url, width, height, altText, visualWidth, visualHeight) => {
      const w = Number(width) || 0;
      const h = Number(height) || 0;
      const vw = Number(visualWidth) || 0;
      const vh = Number(visualHeight) || 0;
      const area = w * h;
      const visualArea = vw * vh;
      if (!isLikelyImageUrl(url, altText)) return false;
      // Skip tiny rendered icons even if the asset is large.
      if (visualArea > 0 && visualArea < 4096) return false;
      if (w >= minSize && h >= minSize) return true;
      if (vw >= minSize && vh >= minSize) return true;
      return area >= minArea || visualArea >= minArea;
    };
    const addUrl = (rawUrl, width, height, altText, visualWidth, visualHeight) => {
      if (!rawUrl) return;
      const url = String(rawUrl).trim();
      if (!url) return;
      if (!shouldKeep(url, width, height, altText, visualWidth, visualHeight)) return;
      const score = scoreImage(url, altText, width, height);
      if (score < 2) return;
      const current = scores.get(url);
      if (current === undefined || score > current) {
        scores.set(url, score);
      }
    };
    const readImgUrl = (img) => {
      return (
        img.currentSrc ||
        img.src ||
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-lazy-src') ||
        ''
      );
    };
    const readSrcSet = (img) => {
      const srcset = img.getAttribute('srcset') || img.srcset || '';
      if (!srcset) return '';
      const candidates = srcset
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((entry) => {
          const [candidateUrl, descriptorRaw] = entry.split(/\s+/);
          const descriptor = descriptorRaw || '';
          let weight = 0;
          if (descriptor.endsWith('w')) {
            weight = Number.parseInt(descriptor.replace(/[^\d]/g, ''), 10) || 0;
          } else if (descriptor.endsWith('x')) {
            weight = Number.parseFloat(descriptor.replace(/[^\d.]/g, '')) || 0;
            weight = weight * 1000;
          }
          return { url: candidateUrl, weight };
        })
        .filter((entry) => entry.url);
      if (candidates.length === 0) return '';
      candidates.sort((a, b) => b.weight - a.weight);
      return candidates[0]?.url || '';
    };
    const images = Array.from(scope.querySelectorAll('img'));
    for (const img of images) {
      const rect = img.getBoundingClientRect();
      const alt = (img.getAttribute('alt') || '').trim();
      const width = img.naturalWidth || rect.width || 0;
      const height = img.naturalHeight || rect.height || 0;
      const style = getComputedStyle(img);
      const opacity = Number.parseFloat(style.opacity || '1');
      const filter = (style.filter || '').toLowerCase();
      const visibility = (style.visibility || '').toLowerCase();
      const display = (style.display || '').toLowerCase();
      if (display === 'none' || visibility === 'hidden') continue;
      if (Number.isFinite(opacity) && opacity < 0.5) continue;
      if (filter.includes('blur(')) continue;
      if (img.complete === false) continue;
      addUrl(readImgUrl(img), width, height, alt, rect.width || 0, rect.height || 0);
      addUrl(readSrcSet(img), width, height, alt, rect.width || 0, rect.height || 0);
    }
    const styled = Array.from(scope.querySelectorAll('[style*="background-image"]'));
    for (const node of styled) {
      const style = getComputedStyle(node);
      const bg = style?.backgroundImage || '';
      const match = bg.match(/url\\((?:\"|')?(.*?)(?:\"|')?\\)/i);
      if (match && match[1]) {
        const rect = node.getBoundingClientRect();
        addUrl(match[1], rect.width || 0, rect.height || 0, '');
      }
    }
    const links = Array.from(scope.querySelectorAll('a[href], [data-href], [data-url]'));
    for (const node of links) {
      const href =
        node.getAttribute?.('href') ||
        node.getAttribute?.('data-href') ||
        node.getAttribute?.('data-url') ||
        '';
      if (!href) continue;
      const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
      addUrl(href, rect.width || 0, rect.height || 0, (node.textContent || '').trim());
    }
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([url]) => url);
    urls.push(...sorted);
    return { urls, count: urls.length };
  })()`;
}
