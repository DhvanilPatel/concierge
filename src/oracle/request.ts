import fs from 'node:fs/promises';
import type {
  FileContent,
  MinimalFsModule,
  RunOracleOptions,
} from './types.js';
import { DEFAULT_SYSTEM_PROMPT } from './config.js';
import { createFileSections, readFiles } from './files.js';
import { formatFileSection } from './markdown.js';
import { createFsAdapter } from './fsAdapter.js';

export function buildPrompt(basePrompt: string, files: FileContent[], cwd = process.cwd()): string {
  if (!files.length) {
    return basePrompt;
  }
  const sections = createFileSections(files, cwd);
  const sectionText = sections.map((section) => section.sectionText).join('\n\n');
  return `${basePrompt.trim()}\n\n${sectionText}`;
}

export async function renderPromptMarkdown(
  options: Pick<RunOracleOptions, 'prompt' | 'file' | 'system'>,
  deps: { cwd?: string; fs?: MinimalFsModule } = {},
): Promise<string> {
  const cwd = deps.cwd ?? process.cwd();
  const fsModule = deps.fs ?? createFsAdapter(fs);
  const files = await readFiles(options.file ?? [], { cwd, fsModule });
  const sections = createFileSections(files, cwd);
  const systemPrompt = options.system?.trim() || DEFAULT_SYSTEM_PROMPT;
  const userPrompt = (options.prompt ?? '').trim();
  const lines = ['[SYSTEM]', systemPrompt, ''];
  lines.push('[USER]', userPrompt, '');
  sections.forEach((section) => {
    lines.push(formatFileSection(section.displayPath, section.content));
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
