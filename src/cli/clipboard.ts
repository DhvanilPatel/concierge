import { spawn } from 'node:child_process';

type RunCommand = (command: string, args: string[], input: string) => Promise<{ code: number }>;

export interface CopyResult {
  success: boolean;
  command?: string;
}

export interface CopyDeps {
  platform?: NodeJS.Platform;
  runCommand?: RunCommand;
}

const DEFAULT_COMMANDS: Record<NodeJS.Platform, Array<{ command: string; args?: string[] }>> = {
  darwin: [{ command: 'pbcopy' }],
  win32: [{ command: 'clip.exe' }, { command: 'clip' }],
  linux: [
    { command: 'wl-copy' },
    { command: 'xclip', args: ['-selection', 'clipboard'] },
    { command: 'xsel', args: ['--clipboard', '--input'] },
  ],
  aix: [],
  android: [],
  freebsd: [],
  openbsd: [],
  sunos: [],
  cygwin: [{ command: 'clip.exe' }, { command: 'clip' }],
};

function fallbackCommands(): Array<{ command: string; args?: string[] }> {
  return [
    { command: 'pbcopy' },
    { command: 'clip.exe' },
    { command: 'clip' },
    { command: 'wl-copy' },
    { command: 'xclip', args: ['-selection', 'clipboard'] },
    { command: 'xsel', args: ['--clipboard', '--input'] },
  ];
}

const defaultRunCommand: RunCommand = (command, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('exit', (code) => {
      resolve({ code: code ?? 1 });
    });
    if (child.stdin) {
      child.stdin.end(input);
    }
  });

export async function copyToClipboard(text: string, deps: CopyDeps = {}): Promise<CopyResult> {
  const platform = deps.platform ?? process.platform;
  const run = deps.runCommand ?? defaultRunCommand;
  const platformCommands = DEFAULT_COMMANDS[platform] ?? [];
  const attempts = platformCommands.length > 0 ? platformCommands : fallbackCommands();

  for (const candidate of attempts) {
    try {
      const { code } = await run(candidate.command, candidate.args ?? [], text);
      if (code === 0) {
        return { success: true, command: candidate.command };
      }
    } catch {
      // try next
    }
  }

  return { success: false };
}
