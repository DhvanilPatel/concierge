export type OracleUserErrorCategory = 'file-validation' | 'browser-automation' | 'prompt-validation';

export interface OracleUserErrorDetails {
  [key: string]: unknown;
}

export class OracleUserError extends Error {
  readonly category: OracleUserErrorCategory;
  readonly details?: OracleUserErrorDetails;

  constructor(
    category: OracleUserErrorCategory,
    message: string,
    details?: OracleUserErrorDetails,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'OracleUserError';
    this.category = category;
    this.details = details;
    if (cause) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class FileValidationError extends OracleUserError {
  constructor(message: string, details?: OracleUserErrorDetails, cause?: unknown) {
    super('file-validation', message, details, cause);
    this.name = 'FileValidationError';
  }
}

export class BrowserAutomationError extends OracleUserError {
  constructor(message: string, details?: OracleUserErrorDetails, cause?: unknown) {
    super('browser-automation', message, details, cause);
    this.name = 'BrowserAutomationError';
  }
}

export class PromptValidationError extends OracleUserError {
  constructor(message: string, details?: OracleUserErrorDetails, cause?: unknown) {
    super('prompt-validation', message, details, cause);
    this.name = 'PromptValidationError';
  }
}

export function asOracleUserError(error: unknown): OracleUserError | null {
  if (error instanceof OracleUserError) {
    return error;
  }
  return null;
}
