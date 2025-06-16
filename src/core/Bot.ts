import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import { HistoryManagerInterface } from "../managers/HistoryManagerInterface";
import { BotMessageHistory } from "../managers/BotMessageHistory";
import { OpenAIPromptService } from "../services/prompt/OpenAIPromptService";
import { GeminiPromptService } from "../services/prompt/GeminiPromptService";
import { PromptServiceInterface } from "../services/prompt/PromptServiceInterface";
import { DynamoDBService } from "../services/state/DynamoDBService";
import { FROM, TYPE, log } from "../utils/logger";
import { LocalStateService } from "../services/state/LocalStateService";
import { ChatCompletionCreateParams } from "openai/resources";

export type BotResultCallback = (
  result: string,
  message: TelegramBot.Message,
  instance: Bot
) => void | Promise<void>;

/**
 * Represents information about a bot message.
 */
export type BotMessageInfo = {
  messageId: number;
  username: string;
  mention: string;
  userId: number | undefined;
  text: string;
  chatId: number;
  isBot: boolean;
  isAllowedChat: boolean;
  isTextMessage: boolean;
};

/**
 * Represents the configuration options for the Bot.
 */
export type BotConfig = {
  /**
   * The prompt service used by the Bot.
   */
  promptService: PromptServiceInterface<unknown>;
  /**
   * The history service used by the Bot.
   */
  historyService: HistoryManagerInterface<unknown>;
  /**
   * The allowed chats for the Bot.
   */
  allowedChats: string[];
  /**
   * The command used by the Bot.
   */
  command: string;
  /**
   * The default response used by the Bot.
   */
  defaultResponse: string;
  /**
   * The options for the Telegram Bot.
   */
  telegramBot: TelegramBot;
  /**
   * The function which define the end of the conversation. Must return a value which will be used as the result of the conversation.
   * @param message - The message indicating the end of the conversation.
   * @returns The result of the end of conversation function, used as the result of the conversation.
   */
  endOfConversationFn: (message: string) => any;
};

/**
 * Configuration object for creating a bot.
 */
export type BotCreateConfig = {
  /**
   * The command used to invoke the bot.
   */
  command: string;
  /**
   * The AI provider to use ("openai" or "gemini").
   */
  provider: "openai" | "gemini";
  /**
   * The OpenAI API key (required when provider is "openai").
   */
  openAIKey?: string;
  /**
   * The Gemini API key (required when provider is "gemini").
   */
  geminiKey?: string;
  /**
   * The name of the DynamoDB table used for storing conversation history.
   * If empty, local storage will be used.
   */
  dynamoDBTableName?: string;
  /**
   * An array of allowed chat IDs.
   */
  allowedChats: string[];
  /**
   * The default response when the bot doesn't have a specific answer.
   */
  defaultResponse: string;
  /**
   * A function that generates the system prompt for the chat.
   * @param username - The username of the chat participant.
   * @returns The system prompt.
   */
  systemPromptFunc: (username?: string) => string;
  /**
   * The model to use for chat completion.
   * For OpenAI: e.g., "gpt-3.5-turbo", "gpt-4"
   * For Gemini: e.g., "gemini-pro", "gemini-pro-vision"
   */
  model: string;
  /**
   * A function called when the conversation ends.
   * @param message - The final message of the conversation.
   * @returns The result of the end of conversation function.
   */
  endOfConversationFn: (message: string) => any;
  /**
   * Optional options for configuring the Telegram bot.
   */
  telegramBot: TelegramBot;
};

/**
 * Represents a Bot that interacts with users through Telegram.
 */
export class Bot {
  public telegramBot: TelegramBot;
  private historyManager: HistoryManagerInterface<unknown>;
  private promptService: PromptServiceInterface<unknown>;
  private allowedChats: string[];
  private command: string;
  private botInfo: TelegramBot.User | null = null;
  private endOfConversationFn: (message: string) => any;
  private defaultResponse: string = "";

  /**
   * Creates a new instance of the Bot class.
   * @param {BotConfig} config - The configuration object for the Bot.
   * @throws {Error} Throws an error if the telegramToken or allowedChats are missing.
   * @returns {Bot} The newly created Bot instance.
   */
  constructor({
    promptService,
    historyService,
    allowedChats,
    command,
    defaultResponse,
    telegramBot,
    endOfConversationFn,
  }: BotConfig) {
    if (!allowedChats?.length) {
      throw new Error("Missing ALLOWED_CHAT_ID env variable");
    }

    this.telegramBot = telegramBot;
    this.historyManager = historyService;
    this.promptService = promptService;
    this.allowedChats = allowedChats;
    this.command = command;
    this.defaultResponse = defaultResponse || "";
    this.endOfConversationFn = endOfConversationFn;
    return this;
  }

  static createBot({
    command,
    provider,
    openAIKey,
    geminiKey,
    dynamoDBTableName: tableName,
    allowedChats,
    model,
    defaultResponse,
    systemPromptFunc,
    endOfConversationFn,
    telegramBot,
  }: BotCreateConfig) {
    const promptService = this.createPromptService({
      provider,
      openAIKey,
      geminiKey,
      model,
      systemPromptFunc,
    });

    const stateService = tableName
      ? new DynamoDBService({
          tableName,
        })
      : new LocalStateService();
    const historyService = new BotMessageHistory({
      stateService,
    });
    const bot = new Bot({
      promptService,
      command,
      allowedChats,
      historyService,
      defaultResponse,
      telegramBot,
      endOfConversationFn,
    });
    return bot;
  }

  private static createPromptService({
    provider,
    openAIKey,
    geminiKey,
    model,
    systemPromptFunc,
  }: {
    provider: "openai" | "gemini";
    openAIKey?: string;
    geminiKey?: string;
    model: string;
    systemPromptFunc: (username?: string) => string;
  }): PromptServiceInterface<unknown> {
    // Validate required API keys based on provider
    if (provider === "openai" && !openAIKey) {
      throw new Error("OpenAI API key is required when using OpenAI provider");
    }
    if (provider === "gemini" && !geminiKey) {
      throw new Error("Gemini API key is required when using Gemini provider");
    }

    // Create the appropriate prompt service based on provider
    if (provider === "openai") {
      const openai = new OpenAI({
        apiKey: openAIKey!,
      });
      return new OpenAIPromptService({
        openai,
        model: model as ChatCompletionCreateParams["model"],
        systemPromptFunc,
      });
    } else if (provider === "gemini") {
      return new GeminiPromptService({
        apiKey: geminiKey!,
        modelName: model,
        systemPromptFunc,
      });
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async getBotInfo() {
    if (this.botInfo) return this.botInfo;
    const botInfo = await this.telegramBot.getMe();
    this.botInfo = botInfo;
  }

  /**
   * Initiates a conversation with the user based on the message
   * If the message is a JSON object, it marks the end of the conversation
   * @param {TelegramBot.Message} message - received user message
   * @returns {Promise<string | void>} - conversation result returned from endOfConversationFn
   */
  private async respond(messageInfo: BotMessageInfo): Promise<string | void> {
    const { userId, messageId, username, text, chatId } = messageInfo;

    try {
      const history = await this.historyManager.getHistoryById(String(userId));
      const isValidUsername = /^[a-zA-Z0-9_-]{1,64}$/.test(username);

      // Get the response from the prompt service
      const newHistory = await this.promptService.makePrompt(
        isValidUsername ? username : userId?.toString(),
        text,
        history
      );
      const lastLLMMessage = this.promptService.getLastMessage(newHistory);

      log(FROM.BOT, TYPE.INFO, "LLM response:", lastLLMMessage);

      // Handle case where no message was found
      if (!lastLLMMessage) {
        log(FROM.BOT, TYPE.ERROR, "No LLM response found");
        return;
      }

      // Check if the response is a JSON object which marks the end of the conversation
      const result = lastLLMMessage.match(/^(\{.+\})$/m)?.[0];
      const endOfConversation = this.endOfConversationFn(lastLLMMessage);
      if (!!endOfConversation) {
        return endOfConversation;
      }

      // Otherwise continue conversation
      await this.telegramBot.sendMessage(chatId, `🤖 ${lastLLMMessage}`, {
        reply_to_message_id: messageId,
      });

      // Update the conversation history
      await this.historyManager.setHistoryById(String(userId), newHistory);
    } catch (err) {
      log(FROM.BOT, TYPE.ERROR, "Conversation error:", err);
      return;
    }

    return;
  }

  /**
   * Parses the message and returns the message info object
   * @param {TelegramBot.Message} message - received user message
   * @returns {BotMessageInfo} - message info object
   */
  private async getMessageInfo(
    message: TelegramBot.Message
  ): Promise<BotMessageInfo> {
    const chatId = message.chat?.id;
    const userId = message.from?.id;
    const messageId = message.message_id;

    const isAllowedChat = !!this.allowedChats?.includes(String(chatId));

    const text = message.text?.replace(this.command, "").trim() || "";

    const username = message.from?.username || message.from?.first_name || "";
    const isBot = !!message.from?.is_bot;
    const mention = (!!username ? "@" : "") + username;
    const isTextMessage = message.hasOwnProperty("text");

    return {
      messageId,
      username,
      mention,
      userId,
      text,
      chatId,
      isBot,
      isAllowedChat,
      isTextMessage,
    };
  }

  /**
   * Validates the message according to given rules
   * @param {TelegramBot.Message} message - received user message
   * @returns {boolean} - true if the message is valid
   */
  private async getValidMessageInfo(
    message: TelegramBot.Message
  ): Promise<BotMessageInfo | void> {
    if (!message) return;
    const messageInfo = await this.getMessageInfo(message);
    const botInfo = await this.getBotInfo();
    const { userId, text, isBot, isAllowedChat, isTextMessage } = messageInfo;

    const isReplyToBot = message.reply_to_message?.from?.id === botInfo?.id;
    const isAddressingBot =
      isTextMessage && (isReplyToBot || message.text?.startsWith(this.command));

    const result =
      !!userId && !!text && !isBot && isAllowedChat && isAddressingBot;

    if (!result) {
      log(FROM.BOT, TYPE.ERROR, "Invalid message:", {
        userId,
        text,
        isBot,
        isAllowedChat,
        isAddressingBot,
      });
      return;
    }
    return messageInfo;
  }

  /**
   * Processes the message, initiates a conversation and processes the conversation result
   * @param {TelegramBot.Message} message - received user message
   * @returns
   */
  public async processMessage(
    message: TelegramBot.Message,
    callback?: BotResultCallback
  ): Promise<any | void> {
    log(FROM.BOT, TYPE.INFO, "Message received:", message);

    const botInfo = await this.getBotInfo();
    const validMessage = await this.getValidMessageInfo(message);
    log(FROM.BOT, TYPE.INFO, "Bot info:", botInfo);

    if (!validMessage) return;

    const { text, chatId } = validMessage;

    const isHelpNeeded =
      !text ||
      text.match(/help/i) ||
      text.match(/start/i) ||
      text === "" ||
      text === `@${botInfo?.username}`;

    if (isHelpNeeded) {
      this.telegramBot.sendMessage(chatId, this.defaultResponse);
      return;
    }

    // Start a conversation with the user
    try {
      const result = await this.respond(validMessage);
      log(FROM.BOT, TYPE.INFO, "Conversation result:", result);
      if (result) {
        await callback?.(result, message, this);
        return result;
      }
    } catch (err) {
      log(FROM.BOT, TYPE.ERROR, "Conversation error:", err);
    }

    log(FROM.BOT, TYPE.SUCCESS, "Message processed");
    return;
  }
}
