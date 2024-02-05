import OpenAI from "openai";
import { PromptServiceInterface } from "./PromptServiceInterface";
import moment from "moment";
import { FROM, TYPE, log } from "../../utils/logger";
import { ChatCompletionCreateParams } from "openai/resources";
import { match } from "assert";

/**
 * Configuration object for the OpenAIPromptService.
 */
export type OpenAIPromptServiceConfig = {
  /**
   * The OpenAI instance to be used for generating prompts.
   */
  openai: OpenAI;

  /**
   * The model to be used for generating prompts.
   */
  model: ChatCompletionCreateParams["model"];

  /**
   * A function that generates the system prompt based on the username.
   *
   * @param username - The username for which the system prompt is generated.
   * @returns The generated system prompt.
   */
  systemPromptFunc: (username: string) => string;
};

/**
 * Service for making prompts for OpenAI chat completions.
 */
export class OpenAIPromptService
  implements
    PromptServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private openai: OpenAI;
  private model: ChatCompletionCreateParams["model"];
  private systemPromptFunc: (username: string) => string;

  /**
   * Constructs a new instance of the OpenAIPromptService.
   *
   * @param openai - The OpenAI instance.
   * @param systemPromptFunc - The function to generate system prompts.
   */
  constructor({ openai, model, systemPromptFunc }: OpenAIPromptServiceConfig) {
    this.openai = openai;
    this.model = model;
    this.systemPromptFunc = systemPromptFunc;
    return this;
  }

  /**
   * Makes a prompt for OpenAI chat completions.
   *
   * @param username - The username of the user.
   * @param userInput - The user's input.
   * @param messages - The array of chat messages.
   * @returns A promise that resolves to an array of chat messages.
   */
  public async makePrompt(
    username: string,
    userInput: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    log(FROM.OPEN_AI, TYPE.INFO, username, userInput);
    if (!messages.length) {
      const isValidUsername = username?.match(/^[a-z0-9]+$/);
      messages.push({
        role: "system",
        content: this.systemPromptFunc(isValidUsername ? username : ""),
      });
    }
    messages.push({
      role: "user",
      content: userInput,
      name: username || String(Date.now()),
    });
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 200,
        temperature: 0,
      });
      messages.push(response?.choices?.[0].message);
      log(FROM.OPEN_AI, TYPE.INFO, response?.choices?.[0]?.message.content);
      return messages;
    } catch (err) {
      log(FROM.OPEN_AI, TYPE.ERROR, err);
      return messages;
    }
  }
}
