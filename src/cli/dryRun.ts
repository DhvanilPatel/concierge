import chalk from 'chalk';
import type { RunConciergeOptions, PreviewMode } from '../concierge.js';
import { assembleBrowserPrompt, type BrowserPromptArtifacts } from '../browser/prompt.js';
import type { BrowserAttachment } from '../browser/types.js';
import type { BrowserSessionConfig } from '../sessionStore.js';
import { buildTokenEstimateSuffix, formatAttachmentLabel } from '../browser/promptSummary.js';
import { buildCookiePlan } from '../browser/policies.js';

interface DryRunDeps {
  assembleBrowserPromptImpl?: typeof assembleBrowserPrompt;
}

export async function runDryRunSummary(
  {
    runOptions,
    cwd,
    version,
    log,
    browserConfig,
  }: {
    runOptions: RunConciergeOptions;
    cwd: string;
    version: string;
    log: (message: string) => void;
    browserConfig?: BrowserSessionConfig;
  },
  deps: DryRunDeps = {},
): Promise<void> {
  await runBrowserDryRun({ runOptions, cwd, version, log, browserConfig }, deps);
}

async function runBrowserDryRun(
  {
    runOptions,
    cwd,
    version,
    log,
    browserConfig,
  }: {
    runOptions: RunConciergeOptions;
    cwd: string;
    version: string;
    log: (message: string) => void;
    browserConfig?: BrowserSessionConfig;
  },
  deps: DryRunDeps,
): Promise<void> {
  const assemblePromptImpl = deps.assembleBrowserPromptImpl ?? assembleBrowserPrompt;
  const artifacts = await assemblePromptImpl(runOptions, { cwd });
  const suffix = buildTokenEstimateSuffix(artifacts);
  const headerLine = `[dry-run] Concierge (${version}) would launch browser mode (${runOptions.model}) with ~${artifacts.estimatedInputTokens.toLocaleString()} tokens${suffix}.`;
  log(chalk.cyan(headerLine));
  logBrowserCookieStrategy(browserConfig, log, 'dry-run');
  logBrowserFileSummary(artifacts, log, 'dry-run');
}

function logBrowserCookieStrategy(
  browserConfig: BrowserSessionConfig | undefined,
  log: (message: string) => void,
  label: string,
) {
  if (!browserConfig) return;
  const plan = buildCookiePlan(browserConfig);
  log(chalk.bold(`[${label}] ${plan.description}`));
}

function logBrowserFileSummary(artifacts: BrowserPromptArtifacts, log: (message: string) => void, label: string) {
  if (artifacts.attachments.length > 0) {
    const prefix = artifacts.bundled ? `[${label}] Bundled upload:` : `[${label}] Attachments to upload:`;
    log(chalk.bold(prefix));
    artifacts.attachments.forEach((attachment: BrowserAttachment) => {
      log(`  • ${formatAttachmentLabel(attachment)}`);
    });
    if (artifacts.bundled) {
      log(
        chalk.dim(
          `  (bundled ${artifacts.bundled.originalCount} files into ${artifacts.bundled.bundlePath})`,
        ),
      );
    }
    return;
  }
  if (artifacts.inlineFileCount > 0) {
    log(chalk.bold(`[${label}] Inline file content:`));
    log(`  • ${artifacts.inlineFileCount} file${artifacts.inlineFileCount === 1 ? '' : 's'} pasted directly into the composer.`);
    return;
  }
  log(chalk.dim(`[${label}] No files attached.`));
}

export async function runBrowserPreview(
  {
    runOptions,
    cwd,
    version,
    previewMode,
    log,
  }: {
    runOptions: RunConciergeOptions;
    cwd: string;
    version: string;
    previewMode: PreviewMode;
    log: (message: string) => void;
  },
  deps: DryRunDeps = {},
): Promise<void> {
  const assemblePromptImpl = deps.assembleBrowserPromptImpl ?? assembleBrowserPrompt;
  const artifacts = await assemblePromptImpl(runOptions, { cwd });
  const suffix = buildTokenEstimateSuffix(artifacts);
  const headerLine = `[preview] Concierge (${version}) browser mode (${runOptions.model}) with ~${artifacts.estimatedInputTokens.toLocaleString()} tokens${suffix}.`;
  log(chalk.cyan(headerLine));
  logBrowserFileSummary(artifacts, log, 'preview');
  if (previewMode === 'json' || previewMode === 'full') {
    const attachmentSummary = artifacts.attachments.map((attachment) => ({
      path: attachment.path,
      displayPath: attachment.displayPath,
      sizeBytes: attachment.sizeBytes,
    }));
    const previewPayload = {
      model: runOptions.model,
      engine: 'browser' as const,
      composerText: artifacts.composerText,
      attachments: attachmentSummary,
      inlineFileCount: artifacts.inlineFileCount,
      bundled: artifacts.bundled,
      tokenEstimate: artifacts.estimatedInputTokens,
    };
    log('');
    log(chalk.bold('Preview JSON'));
    log(JSON.stringify(previewPayload, null, 2));
  }
  if (previewMode === 'full') {
    log('');
    log(chalk.bold('Composer Text'));
    log(artifacts.composerText || chalk.dim('(empty prompt)'));
  }
}
