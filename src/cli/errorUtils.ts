const LOGGED_SYMBOL = Symbol('concierge.alreadyLogged');

export function markErrorLogged(error: unknown): void {
  if (error instanceof Error) {
    (error as Error & { [LOGGED_SYMBOL]?: true })[LOGGED_SYMBOL] = true;
  }
}

export function isErrorLogged(error: unknown): boolean {
  return Boolean(error instanceof Error && (error as Error & { [LOGGED_SYMBOL]?: true })[LOGGED_SYMBOL]);
}
