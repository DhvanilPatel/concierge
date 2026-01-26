import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { RunConciergeOptions } from '../concierge.js';
import {
  readFiles,
  createFileSections,
  MODEL_CONFIGS,
  TOKENIZER_OPTIONS,
  formatFileSection,
} from '../concierge.js';
import { isKnownModel } from '../concierge/modelResolver.js';
import { buildPromptMarkdown } from '../concierge/promptAssembly.js';
import type { BrowserAttachment } from './types.js';
import { buildAttachmentPlan } from './policies.js';

const DEFAULT_BROWSER_INLINE_CHAR_BUDGET = 60_000;

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif',
  '.pdf',
]);

function sanitizeUploadName(value: string): string {
  const cleaned = value.replace(/[\\/:]+/g, '__').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return cleaned.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function buildUploadFileName(displayPath: string, absolutePath: string): string {
  const fallbackBase = path.basename(absolutePath);
  const ext = path.extname(displayPath || fallbackBase) || path.extname(fallbackBase);
  const base = displayPath || fallbackBase;
  const sanitized = sanitizeUploadName(base) || fallbackBase.replace(/\s+/g, '_');
  if (sanitized.length <= 180) return sanitized;
  const hash = crypto.createHash('sha1').update(base).digest('hex').slice(0, 8);
  const stem = sanitized.replace(new RegExp(`${ext.replace('.', '\\.')}$`), '');
  const trimmed = stem.slice(0, 120);
  return `${trimmed}__${hash}${ext}`;
}

async function ensureUniqueAttachmentUploads(
  attachments: BrowserAttachment[],
  cwd: string,
): Promise<BrowserAttachment[]> {
  if (attachments.length === 0) return attachments;

  const deduped: BrowserAttachment[] = [];
  const seenPaths = new Set<string>();
  for (const attachment of attachments) {
    const absolute = path.resolve(attachment.path);
    if (seenPaths.has(absolute)) {
      continue;
    }
    seenPaths.add(absolute);
    deduped.push(attachment);
  }

  const byBase = new Map<string, BrowserAttachment[]>();
  for (const attachment of deduped) {
    const base = path.basename(attachment.path).toLowerCase();
    const bucket = byBase.get(base) ?? [];
    bucket.push(attachment);
    byBase.set(base, bucket);
  }

  const duplicates = Array.from(byBase.entries()).filter(([, list]) => list.length > 1);
  if (duplicates.length === 0) {
    return deduped;
  }

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'concierge-uploads-'));
  const usedNames = new Set<string>();
  const result: BrowserAttachment[] = [];

  for (const attachment of deduped) {
    const base = path.basename(attachment.path).toLowerCase();
    const isDuplicate = (byBase.get(base)?.length ?? 0) > 1;
    if (!isDuplicate) {
      result.push(attachment);
      continue;
    }

    const rel =
      attachment.displayPath ||
      path.relative(cwd, attachment.path) ||
      path.basename(attachment.path);
    let fileName = buildUploadFileName(rel, attachment.path);
    const ext = path.extname(fileName);
    const stem = ext ? fileName.slice(0, -ext.length) : fileName;
    let counter = 1;
    while (usedNames.has(fileName.toLowerCase())) {
      counter += 1;
      fileName = `${stem}__${counter}${ext}`;
    }
    usedNames.add(fileName.toLowerCase());
    const uploadPath = path.join(uploadDir, fileName);
    await fs.copyFile(attachment.path, uploadPath);
    result.push({
      ...attachment,
      path: uploadPath,
    });
  }

  return result;
}

export function isMediaFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

export interface BrowserPromptArtifacts {
  markdown: string;
  composerText: string;
  estimatedInputTokens: number;
  attachments: BrowserAttachment[];
  inlineFileCount: number;
  tokenEstimateIncludesInlineFiles: boolean;
  attachmentsPolicy: 'auto' | 'never' | 'always';
  attachmentMode: 'inline' | 'upload' | 'bundle';
  fallback?: {
    composerText: string;
    attachments: BrowserAttachment[];
    bundled?: { originalCount: number; bundlePath: string } | null;
  } | null;
  bundled?: { originalCount: number; bundlePath: string } | null;
}

interface AssemblePromptDeps {
  cwd?: string;
  readFilesImpl?: typeof readFiles;
  tokenizeImpl?: typeof MODEL_CONFIGS['gpt-5.1']['tokenizer'];
}

export async function assembleBrowserPrompt(
  runOptions: RunConciergeOptions,
  deps: AssemblePromptDeps = {},
): Promise<BrowserPromptArtifacts> {
  const cwd = deps.cwd ?? process.cwd();
  const readFilesFn = deps.readFilesImpl ?? readFiles;

  const allFilePaths = runOptions.file ?? [];
  const textFilePaths = allFilePaths.filter((f) => !isMediaFile(f));
  const mediaFilePaths = allFilePaths.filter((f) => isMediaFile(f));

  const mediaAttachments: BrowserAttachment[] = await Promise.all(
    mediaFilePaths.map(async (filePath) => {
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
      const stats = await fs.stat(resolvedPath);
      return {
        path: resolvedPath,
        displayPath: path.relative(cwd, resolvedPath) || path.basename(resolvedPath),
        sizeBytes: stats.size,
      };
    }),
  );

  const files = await readFilesFn(textFilePaths, { cwd });
  const basePrompt = (runOptions.prompt ?? '').trim();
  const userPrompt = basePrompt;
  const systemPrompt = runOptions.system?.trim() || '';
  const sections = createFileSections(files, cwd);
  const markdown = buildPromptMarkdown(systemPrompt, userPrompt, sections);

  const attachmentsPolicy: 'auto' | 'never' | 'always' =
    runOptions.browserInlineFiles
      ? 'never'
      : runOptions.browserAttachments ?? 'auto';
  const bundleRequested = Boolean(runOptions.browserBundleFiles);

  const inlinePlan = buildAttachmentPlan(sections, { inlineFiles: true, bundleRequested });
  const uploadPlan = buildAttachmentPlan(sections, { inlineFiles: false, bundleRequested });

  const baseComposerSections: string[] = [];
  if (systemPrompt) baseComposerSections.push(systemPrompt);
  if (userPrompt) baseComposerSections.push(userPrompt);

  const inlineComposerText = [...baseComposerSections, inlinePlan.inlineBlock].filter(Boolean).join('\n\n').trim();
  const selectedPlan =
    attachmentsPolicy === 'always'
      ? uploadPlan
      : attachmentsPolicy === 'never'
        ? inlinePlan
        : inlineComposerText.length <= DEFAULT_BROWSER_INLINE_CHAR_BUDGET || sections.length === 0
          ? inlinePlan
          : uploadPlan;

  const composerText = (selectedPlan.inlineBlock
    ? [...baseComposerSections, selectedPlan.inlineBlock]
    : baseComposerSections
  )
    .filter(Boolean)
    .join('\n\n')
    .trim();

  let attachments: BrowserAttachment[] = [...selectedPlan.attachments, ...mediaAttachments];

  const shouldBundle = selectedPlan.shouldBundle;
  let bundleText: string | null = null;
  let bundled: { originalCount: number; bundlePath: string } | null = null;
  if (shouldBundle) {
    const bundleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'concierge-browser-bundle-'));
    const bundlePath = path.join(bundleDir, 'attachments-bundle.txt');
    const bundleLines: string[] = [];
    sections.forEach((section) => {
      bundleLines.push(formatFileSection(section.displayPath, section.content).trimEnd());
      bundleLines.push('');
    });
    bundleText = `${bundleLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
    await fs.writeFile(bundlePath, bundleText, 'utf8');
    attachments.length = 0;
    attachments.push({
      path: bundlePath,
      displayPath: bundlePath,
      sizeBytes: Buffer.byteLength(bundleText, 'utf8'),
    });
    attachments.push(...mediaAttachments);
    bundled = { originalCount: sections.length, bundlePath };
  }
  attachments = await ensureUniqueAttachmentUploads(attachments, cwd);

  const inlineFileCount = selectedPlan.inlineFileCount;
  const modelConfig = isKnownModel(runOptions.model) ? MODEL_CONFIGS[runOptions.model] : MODEL_CONFIGS['gpt-5.1'];
  const tokenizer = deps.tokenizeImpl ?? modelConfig.tokenizer;
  const tokenizerUserContent =
    inlineFileCount > 0 && selectedPlan.inlineBlock
      ? [userPrompt, selectedPlan.inlineBlock].filter((value) => Boolean(value?.trim())).join('\n\n').trim()
      : userPrompt;
  const tokenizerMessages = [
    systemPrompt ? { role: 'system', content: systemPrompt } : null,
    tokenizerUserContent ? { role: 'user', content: tokenizerUserContent } : null,
  ].filter(Boolean) as Array<{ role: 'system' | 'user'; content: string }>;
  let estimatedInputTokens = tokenizer(
    tokenizerMessages.length > 0
      ? tokenizerMessages
      : [{ role: 'user', content: '' }],
    TOKENIZER_OPTIONS,
  );
  const tokenEstimateIncludesInlineFiles = inlineFileCount > 0 && Boolean(selectedPlan.inlineBlock);
  if (!tokenEstimateIncludesInlineFiles && sections.length > 0) {
    const attachmentText =
      bundleText ??
      sections
        .map((section) => formatFileSection(section.displayPath, section.content).trimEnd())
        .join('\n\n');
    const attachmentTokens = tokenizer(
      [{ role: 'user', content: attachmentText }],
      TOKENIZER_OPTIONS,
    );
    estimatedInputTokens += attachmentTokens;
  }

  let fallback: BrowserPromptArtifacts['fallback'] = null;
  if (attachmentsPolicy === 'auto' && selectedPlan.mode === 'inline' && sections.length > 0) {
    const fallbackComposerText = baseComposerSections.join('\n\n').trim();
    let fallbackAttachments = [...uploadPlan.attachments, ...mediaAttachments];
    let fallbackBundled: { originalCount: number; bundlePath: string } | null = null;
    if (uploadPlan.shouldBundle) {
      const bundleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'concierge-browser-bundle-'));
      const bundlePath = path.join(bundleDir, 'attachments-bundle.txt');
      const bundleLines: string[] = [];
      sections.forEach((section) => {
        bundleLines.push(formatFileSection(section.displayPath, section.content).trimEnd());
        bundleLines.push('');
      });
      const fallbackBundleText = `${bundleLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
      await fs.writeFile(bundlePath, fallbackBundleText, 'utf8');
      fallbackAttachments.length = 0;
      fallbackAttachments.push({
        path: bundlePath,
        displayPath: bundlePath,
        sizeBytes: Buffer.byteLength(fallbackBundleText, 'utf8'),
      });
      fallbackAttachments.push(...mediaAttachments);
      fallbackBundled = { originalCount: sections.length, bundlePath };
    }
    fallbackAttachments = await ensureUniqueAttachmentUploads(fallbackAttachments, cwd);
    fallback = {
      composerText: fallbackComposerText,
      attachments: fallbackAttachments,
      bundled: fallbackBundled,
    };
  }
  if (!fallback && sections.length > 0 && selectedPlan.mode !== 'inline') {
    const fallbackComposerText = [...baseComposerSections, inlinePlan.inlineBlock].filter(Boolean).join('\n\n').trim();
    let fallbackAttachments = [...mediaAttachments];
    fallbackAttachments = await ensureUniqueAttachmentUploads(fallbackAttachments, cwd);
    fallback = {
      composerText: fallbackComposerText,
      attachments: fallbackAttachments,
      bundled: null,
    };
  }

  return {
    markdown,
    composerText,
    estimatedInputTokens,
    attachments,
    inlineFileCount,
    tokenEstimateIncludesInlineFiles,
    attachmentsPolicy,
    attachmentMode: selectedPlan.mode,
    fallback,
    bundled,
  };
}
