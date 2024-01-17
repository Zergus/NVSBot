export interface StateServiceInterface<T> {
  getItemById(id: string): Promise<T[]>;
  setItemById(id: string, update: T[]): Promise<void>;
}
