export interface HistoryManagerInterface<T> {
  getHistoryById(id: string): Promise<T[]>;
  setHistoryById(id: string, newHistory: T[]): Promise<void>;
  getLastMessage(history: T[]): string;
}
