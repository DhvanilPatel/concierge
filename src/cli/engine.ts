export type EngineMode = 'api' | 'browser';

export function defaultWaitPreference(model: string, engine: EngineMode): boolean {
  void model;
  void engine;
  return true;
}

/**
 * Browser-only build: always resolve to the browser engine.
 */
export function resolveEngine(
  {
    engine,
    browserFlag,
  }: { engine?: EngineMode; browserFlag?: boolean; env: NodeJS.ProcessEnv },
): EngineMode {
  void engine;
  if (browserFlag) {
    return 'browser';
  }
  return 'browser';
}
