/**
 * Represents an interface for a prompt service.
 * @template T The type of the prompt result.
 */
export interface PromptServiceInterface<T> {
  /**
   * Makes a prompt with the specified arguments.
   * @param args The arguments for the prompt.
   * @returns A promise that resolves to an array of prompt results.
   */
  makePrompt(...args: any[]): Promise<T[]>;
}
