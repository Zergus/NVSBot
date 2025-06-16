import OpenAI from "openai";
import { HistoryManagerInterface } from "./HistoryManagerInterface";
import { StateServiceInterface } from "../services/state/StateServiceInterface";
import { FROM, TYPE, log } from "../utils/logger";

export type BotMessageHistoryConfig = {
  stateService: StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
};

/**
 * Represents a manager for storing and retrieving chat message history.
 */
export class BotMessageHistory
  implements
    HistoryManagerInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private stateService: StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>;

  /**
   * Creates a new instance of BotMessageHistory.
   * @param {BotMessageHistoryConfig} config - The configuration object for BotMessageHistory.
   */
  constructor({ stateService }: BotMessageHistoryConfig) {
    this.stateService = stateService;
  }

  /**
   * Updates the history of the conversation.
   * @param {string} id - The ID of the conversation.
   * @param {OpenAI.Chat.Completions.ChatCompletionMessageParam[]} messages - The messages to be saved.
   * @returns {Promise<void>} A promise that resolves when the history is updated.
   */
  public async setHistoryById(
    id: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): Promise<void> {
    try {
      await this.stateService.setItemById(id, messages);
    } catch (error) {
      log(FROM.HISTORY, TYPE.ERROR, error);
    }
    return;
  }

  /**
   * Retrieves the history of the conversation.
   * @param {string} id - The ID of the conversation.
   * @returns {Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>} A promise that resolves with the conversation history.
   */
  public async getHistoryById(
    id: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    try {
      return await this.stateService.getItemById(id);
    } catch (error) {
      log(FROM.HISTORY, TYPE.ERROR, error);
      return [];
    }
  }

  /**
   * Retrieves the content of the last message in the history.
   * @param {OpenAI.Chat.Completions.ChatCompletionMessageParam[]} history - The chat message history.
   * @returns {string} The content of the last message, or an empty string if the history is empty.
   */
  public getLastMessage(
    history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): string {
    console.log(history);
    return String(history.at(-1)?.content) || "";
  }
}
