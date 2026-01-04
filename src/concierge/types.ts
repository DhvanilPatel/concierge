export type TokenizerFn = (input: unknown, options?: Record<string, unknown>) => number;

export type KnownModelName =
  | 'gpt-5.1-pro'
  | 'gpt-5-pro'
  | 'gpt-5.1'
  | 'gpt-5.2'
  | 'gpt-5.2-instant'
  | 'gpt-5.2-pro'
  | 'gemini-3-pro';

// ModelName now allows arbitrary strings so custom IDs can pass through.
export type ModelName = KnownModelName | (string & {});

export type ProModelName = 'gpt-5.1-pro' | 'gpt-5-pro' | 'gpt-5.2-pro';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type ThinkingTimeLevel = 'light' | 'standard' | 'extended' | 'heavy';

export interface ModelConfig {
  model: ModelName;
  tokenizer: TokenizerFn;
  inputLimit: number;
  pricing?: {
    inputPerToken: number;
    outputPerToken: number;
  } | null;
  reasoning: { effort: ReasoningEffort } | null;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface FileSection {
  index: number;
  absolutePath: string;
  displayPath: string;
  sectionText: string;
  content: string;
}

export interface FsStats {
  isFile(): boolean;
  isDirectory(): boolean;
  size?: number;
}

export interface MinimalFsModule {
  stat(targetPath: string): Promise<FsStats>;
  readdir(targetPath: string): Promise<string[]>;
  readFile(targetPath: string, encoding: NodeJS.BufferEncoding): Promise<string>;
}

export interface FileTokenEntry {
  path: string;
  displayPath: string;
  tokens: number;
  percent?: number;
}

export interface FileTokenStats {
  stats: FileTokenEntry[];
  totalTokens: number;
}

export type PreviewMode = 'summary' | 'json' | 'full';

export interface RunConciergeOptions {
  prompt: string;
  model: ModelName;
  file?: string[];
  slug?: string;
  system?: string;
  silent?: boolean;
  sessionId?: string;
  verbose?: boolean;
  heartbeatIntervalMs?: number;
  /**
   * Browser-only: controls whether `--file` inputs are pasted inline (never upload),
   * uploaded as attachments (always), or selected automatically based on prompt size.
   */
  browserAttachments?: 'auto' | 'never' | 'always';
  browserInlineFiles?: boolean;
  browserBundleFiles?: boolean;
  /** Render plain text instead of ANSI-rendered markdown when printing answers to a rich TTY. */
  renderPlain?: boolean;
  /** Optional absolute path to save only the assistant's final text output. */
  writeOutputPath?: string;
}

export type TransportFailureReason =
  | 'client-timeout'
  | 'connection-lost'
  | 'client-abort'
  | 'api-error'
  | 'model-unavailable'
  | 'unsupported-endpoint'
  | 'unknown';
