import { StateServiceInterface } from "./StateServiceInterface";
import OpenAI from "openai";

/**
 * Represents the local state of the application.
 */
export type LocalState = {
  id: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}[];

/**
 * Represents a service for managing local state.
 */
export class LocalStateService
  implements
    StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private localState: LocalState = [];

  constructor() {
    return this;
  }

  /**
   * Retrieves an item from the local state by its ID.
   * @param id - The ID of the item to retrieve.
   * @returns A promise that resolves to an array of chat completion message parameters.
   */
  public async getItemById(
    id: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    return this.localState.find((state) => state.id === id)?.messages || [];
  }

  /**
   * Sets an item in the local state by its ID.
   * If the item already exists, it updates the messages.
   * If the item does not exist, it creates a new item with the specified ID and messages.
   * @param id - The ID of the item to set.
   * @param update - The updated array of chat completion message parameters.
   * @returns A promise that resolves when the item is set.
   */
  public async setItemById(
    id: string,
    update: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): Promise<void> {
    const item = this.localState.find((state) => state.id === id);
    if (item) {
      item.messages = update;
    } else {
      this.localState.push({ id, messages: update });
    }
    return;
  }
}
