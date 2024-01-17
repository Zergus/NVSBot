import OpenAI from "openai";
import { HistoryManagerInterface } from "./HistoryManagerInterface";
import { StateServiceInterface } from "../services/state/StateServiceInterface";
import { FROM, TYPE, log } from "../utils/logger";

type BotMessageHistoryConfig = {
  stateService: StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
  tableName: string;
};

export class BotMessageHistory
  implements
    HistoryManagerInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private stateService: StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
  private tableName: string;

  constructor({ stateService, tableName }: BotMessageHistoryConfig) {
    this.stateService = stateService;
    this.tableName = tableName;
  }

  /**
   * Updates the history of the conversation
   * @param {string} id - Conversation ID
   * @param {OpenAI.Chat.Completions.ChatCompletionMessageParam[]} messages - Messages to be saved
   * @returns {Promise<void>} Promise that resolves when the history is updated
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
   * Retrieves the history of the conversation
   * @param {string} id - Conversation ID
   * @returns {Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>} Promise that resolves with the conversation history
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
   *
   * @returns The content of the last message, or an empty string if the history is empty.
   */
  public getLastMessage(
    history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): string {
    return String(history.at(-1)?.content) || "";
  }
}
