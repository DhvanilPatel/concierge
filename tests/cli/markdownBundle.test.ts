import { describe, expect, test } from 'vitest';
import { buildMarkdownBundle } from '../../src/cli/markdownBundle.ts';
import { mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('buildMarkdownBundle', () => {
  test('renders system + user + files into markdown and prompt with files', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'oracle-md-'));
    const filePath = path.join(cwd, 'a.txt');
    await writeFile(filePath, 'hello world', 'utf8');

    const bundle = await buildMarkdownBundle({ prompt: 'Do it', file: [filePath], system: 'SYS' }, { cwd });

    expect(bundle.markdown).toMatch('[SYSTEM]');
    expect(bundle.markdown).toMatch('SYS');
    expect(bundle.markdown).toMatch('[USER]');
    expect(bundle.markdown).toMatch('Do it');
    expect(bundle.markdown).toMatch('[FILE: a.txt]');
    expect(bundle.markdown).toMatch('hello world');
    expect(bundle.promptWithFiles).toContain('Do it');
    expect(bundle.promptWithFiles).toContain('hello world');
    expect(bundle.files).toHaveLength(1);
  });
});
