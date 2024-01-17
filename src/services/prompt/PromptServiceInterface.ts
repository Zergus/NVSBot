export interface PromptServiceInterface<T> {
  makePrompt(...args: any[]): Promise<T[]>;
}
