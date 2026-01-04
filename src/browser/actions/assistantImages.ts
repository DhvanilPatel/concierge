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
  const urls = Array.isArray(value?.urls) ? value?.urls.filter((url) => typeof url === 'string') : [];
  const count = typeof value?.count === 'number' ? value.count : urls.length;
  return { urls, count };
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
  let stableCycles = 0;
  let best: AssistantImageSnapshot | null = null;
  while (Date.now() < deadline) {
    const snapshot = await readAssistantImageSnapshot(Runtime, minTurnIndex).catch(() => null);
    if (snapshot && snapshot.urls.length > 0) {
      best = snapshot;
      if (snapshot.urls.length === lastCount) {
        stableCycles += 1;
      } else {
        stableCycles = 0;
        lastCount = snapshot.urls.length;
      }
      if (stableCycles >= 2) {
        return snapshot;
      }
    } else {
      stableCycles = 0;
      lastCount = 0;
    }
    await delay(1000);
  }
  return best ?? { urls: [], count: 0 };
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
    const seen = new Set();
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
    const shouldKeep = (url, width, height, altText) => {
      const w = Number(width) || 0;
      const h = Number(height) || 0;
      const area = w * h;
      if (!isLikelyImageUrl(url, altText)) return false;
      if (w >= minSize && h >= minSize) return true;
      return area >= minArea;
    };
    const addUrl = (rawUrl, width, height, altText) => {
      if (!rawUrl) return;
      const url = String(rawUrl).trim();
      if (!url) return;
      if (!shouldKeep(url, width, height, altText)) return;
      if (seen.has(url)) return;
      seen.add(url);
      urls.push(url);
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
      const first = srcset.split(',')[0];
      return first ? first.trim().split(' ')[0] : '';
    };
    const images = Array.from(scope.querySelectorAll('img'));
    for (const img of images) {
      const rect = img.getBoundingClientRect();
      const alt = (img.getAttribute('alt') || '').trim();
      const width = img.naturalWidth || rect.width || 0;
      const height = img.naturalHeight || rect.height || 0;
      addUrl(readImgUrl(img), width, height, alt);
      addUrl(readSrcSet(img), width, height, alt);
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
    return { urls, count: urls.length };
  })()`;
}
