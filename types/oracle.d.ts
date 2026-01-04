declare module '../src/oracle.js' {
  export function buildPrompt(...args: unknown[]): string;
  export function renderPromptMarkdown(...args: unknown[]): Promise<string>;
}
