/**
 * Represents an interface for a state service.
 * @template T - The type of the state item.
 */
export interface StateServiceInterface<T> {
  /**
   * Retrieves an array of state items by their ID.
   * @param id - The ID of the state item.
   * @returns A promise that resolves to an array of state items.
   */
  getItemById(id: string): Promise<T[]>;

  /**
   * Updates the state items with the specified ID.
   * @param id - The ID of the state item.
   * @param update - The updated state items.
   * @returns A promise that resolves when the update is complete.
   */
  setItemById(id: string, update: T[]): Promise<void>;
}
