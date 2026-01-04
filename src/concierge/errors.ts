export type ConciergeUserErrorCategory = 'file-validation' | 'browser-automation' | 'prompt-validation';

export interface ConciergeUserErrorDetails {
  [key: string]: unknown;
}

export class ConciergeUserError extends Error {
  readonly category: ConciergeUserErrorCategory;
  readonly details?: ConciergeUserErrorDetails;

  constructor(
    category: ConciergeUserErrorCategory,
    message: string,
    details?: ConciergeUserErrorDetails,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'ConciergeUserError';
    this.category = category;
    this.details = details;
    if (cause) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class FileValidationError extends ConciergeUserError {
  constructor(message: string, details?: ConciergeUserErrorDetails, cause?: unknown) {
    super('file-validation', message, details, cause);
    this.name = 'FileValidationError';
  }
}

export class BrowserAutomationError extends ConciergeUserError {
  constructor(message: string, details?: ConciergeUserErrorDetails, cause?: unknown) {
    super('browser-automation', message, details, cause);
    this.name = 'BrowserAutomationError';
  }
}

export class PromptValidationError extends ConciergeUserError {
  constructor(message: string, details?: ConciergeUserErrorDetails, cause?: unknown) {
    super('prompt-validation', message, details, cause);
    this.name = 'PromptValidationError';
  }
}

export function asConciergeUserError(error: unknown): ConciergeUserError | null {
  if (error instanceof ConciergeUserError) {
    return error;
  }
  return null;
}
