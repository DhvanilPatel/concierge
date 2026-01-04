import fs from 'node:fs/promises';
import { DEFAULT_SYSTEM_PROMPT } from '../concierge/config.js';
import { buildPrompt } from '../concierge/request.js';
import { createFileSections, readFiles } from '../concierge/files.js';
import { createFsAdapter } from '../concierge/fsAdapter.js';
import { buildPromptMarkdown } from '../concierge/promptAssembly.js';
import type { MinimalFsModule, RunConciergeOptions, FileContent } from '../concierge/types.js';

export interface MarkdownBundle {
  markdown: string;
  promptWithFiles: string;
  systemPrompt: string;
  files: FileContent[];
}

export async function buildMarkdownBundle(
  options: Pick<RunConciergeOptions, 'prompt' | 'file' | 'system'>,
  deps: { cwd?: string; fs?: MinimalFsModule } = {},
): Promise<MarkdownBundle> {
  const cwd = deps.cwd ?? process.cwd();
  const fsModule = deps.fs ?? createFsAdapter(fs);
  const files = await readFiles(options.file ?? [], { cwd, fsModule });
  const sections = createFileSections(files, cwd);
  const systemPrompt = options.system?.trim() || DEFAULT_SYSTEM_PROMPT;
  const userPrompt = (options.prompt ?? '').trim();

  const markdown = buildPromptMarkdown(systemPrompt, userPrompt, sections);
  const promptWithFiles = buildPrompt(userPrompt, files, cwd);
  return { markdown, promptWithFiles, systemPrompt, files };
}
