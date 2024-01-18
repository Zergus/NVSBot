/**
 * Represents the interface for a history manager.
 * @template T - The type of history items.
 */
export interface HistoryManagerInterface<T> {
  /**
   * Retrieves the history by its ID.
   * @param id - The ID of the history.
   * @returns A promise that resolves to an array of history items.
   */
  getHistoryById(id: string): Promise<T[]>;

  /**
   * Sets the history by its ID.
   * @param id - The ID of the history.
   * @param newHistory - The new history to set.
   * @returns A promise that resolves when the history is set.
   */
  setHistoryById(id: string, newHistory: T[]): Promise<void>;

  /**
   * Retrieves the last message from the history.
   * @param history - The history to retrieve the last message from.
   * @returns The last message from the history.
   */
  getLastMessage(history: T[]): string;
}
