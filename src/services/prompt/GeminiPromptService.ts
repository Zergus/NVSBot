import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { PromptServiceInterface } from "./PromptServiceInterface";
import { FROM, TYPE, log } from "../../utils/logger";

/**
 * Configuration object for the GeminiPromptService.
 */
export type GeminiPromptServiceConfig = {
  /**
   * The Google Generative AI API key.
   */
  apiKey: string;

  /**
   * The model name to be used for generating prompts (e.g., "gemini-pro", "gemini-pro-vision").
   */
  modelName: string;

  /**
   * A function that generates the system prompt based on the username.
   *
   * @param username - The username for which the system prompt is generated.
   * @returns The generated system prompt.
   */
  systemPromptFunc: (username: string) => string;
};

/**
 * Represents a message in the Gemini chat format.
 */
export interface GeminiMessage {
  role: "user" | "model";
  parts: string;
}

/**
 * Service for making prompts for Google Gemini chat completions.
 */
export class GeminiPromptService
  implements PromptServiceInterface<GeminiMessage>
{
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private systemPromptFunc: (username: string) => string;
  private chatSessions: Map<string, ChatSession> = new Map();

  /**
   * Constructs a new instance of the GeminiPromptService.
   *
   * @param apiKey - The Google Generative AI API key.
   * @param modelName - The name of the model to use.
   * @param systemPromptFunc - The function to generate system prompts.
   */
  constructor({
    apiKey,
    modelName,
    systemPromptFunc,
  }: GeminiPromptServiceConfig) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.systemPromptFunc = systemPromptFunc;
  }

  /**
   * Makes a prompt for Gemini chat completions.
   *
   * @param username - The username of the user.
   * @param userInput - The user's input.
   * @param messages - The array of chat messages.
   * @returns A promise that resolves to an array of chat messages.
   */
  public async makePrompt(
    username: string,
    userInput: string,
    messages: GeminiMessage[]
  ): Promise<GeminiMessage[]> {
    log(FROM.GEMINI, TYPE.INFO, username, userInput);
    try {
      const systemInstruction = this.systemPromptFunc(username);
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction,
      });
      const history = messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      }));
      const chat = model.startChat({
        history,
      });
      this.chatSessions.set(username, chat);
      messages.push({
        role: "user",
        parts: userInput,
      });

      const result = await chat.sendMessage(userInput);
      const response = result.response;
      const responseText = response.text();

      messages.push({
        role: "model",
        parts: responseText,
      });

      log(FROM.GEMINI, TYPE.INFO, responseText);
      return messages;
    } catch (err) {
      log(FROM.GEMINI, TYPE.ERROR, err);
      return messages;
    }
  }

  /**
   * Clears the chat session for a specific user.
   *
   * @param username - The username whose chat session should be cleared.
   */
  public clearChatSession(username: string): void {
    this.chatSessions.delete(username);
  }

  /**
   * Clears all chat sessions.
   */
  public clearAllChatSessions(): void {
    this.chatSessions.clear();
  }

  /**
   * Gets the last message content from the Gemini message array.
   * @param messages The array of Gemini messages.
   * @returns The content of the last message or null if no message found.
   */
  public getLastMessage(messages: GeminiMessage[]): string | null {
    if (!messages.length) return null;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "model") {
      return lastMessage.parts;
    }

    return null;
  }
}
