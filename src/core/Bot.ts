import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import { HistoryManagerInterface } from "../managers/HistoryManagerInterface";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BotMessageHistory } from "../managers/BotMessageHistory";
import { OpenAIPromptService } from "../services/prompt/OpenAIPromptService";
import { PromptServiceInterface } from "../services/prompt/PromptServiceInterface";
import { DynamoDBService } from "../services/state/DynamoDBService";
import { FROM, TYPE, log } from "../utils/logger";
import { LocalStateService } from "../services/state/LocalStateService";
import { ChatCompletionCreateParams } from "openai/resources";

/**
 * Represents the result of a bot conversation.
 */
export type BotConversationResult = {
  /**
   * The resolution of the conversation, which can be "book", "cancel", or "check".
   */
  resolution: "book" | "cancel" | "check";
  /**
   * The date associated with the conversation result.
   */
  date: string;
  /**
   * The time associated with the conversation result, if available.
   */
  time: string | undefined;
  /**
   * The name associated with the conversation result.
   */
  name: string;
  /**
   * The number of people associated with the conversation result, if available.
   */
  people: string | undefined;
};

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
  isAddressingBot: boolean;
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
   * The Telegram token used by the Bot.
   */
  telegramToken: string;
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
  telegramBotOptions: TelegramBot.ConstructorOptions;
  /**
   * The function called when the conversation ends.
   * @param message - The message indicating the end of the conversation.
   * @returns The result of the end of conversation function.
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
   * The OpenAI API key.
   */
  openAIKey: string;
  /**
   * The name of the DynamoDB table used for storing conversation history.
   */
  dynamoDBTableName: string;
  /**
   * An array of allowed chat IDs.
   */
  allowedChats: string[];
  /**
   * The Telegram bot token.
   */
  telegramToken: string;
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
   */
  model: ChatCompletionCreateParams["model"];
  /**
   * A function called when the conversation ends.
   * @param message - The final message of the conversation.
   * @returns The result of the end of conversation function.
   */
  endOfConversationFn: (message: string) => any;
  /**
   * Optional options for configuring the Telegram bot.
   */
  telegramBotOptions?: TelegramBot.ConstructorOptions;
};

/**
 * Represents a Bot that interacts with users through Telegram.
 */
export class Bot {
  private telegramBot: TelegramBot;
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
    telegramToken,
    allowedChats,
    command,
    defaultResponse,
    telegramBotOptions,
    endOfConversationFn,
  }: BotConfig) {
    if (!telegramToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN env variable");
    }

    if (!allowedChats?.length) {
      throw new Error("Missing ALLOWED_CHAT_ID env variable");
    }

    this.telegramBot = new TelegramBot(telegramToken, telegramBotOptions);
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
    openAIKey: apiKey,
    dynamoDBTableName: tableName,
    allowedChats,
    telegramToken,
    defaultResponse,
    systemPromptFunc,
    endOfConversationFn,
    telegramBotOptions = { webHook: true },
  }: BotCreateConfig): Bot {
    const isDev = process.env.NODE_ENV === "development";
    const openai = new OpenAI({
      apiKey,
    });
    const promptService = new OpenAIPromptService({
      openai,
      systemPromptFunc,
    });
    const stateService = isDev
      ? new LocalStateService()
      : new DynamoDBService({
          tableName,
        });
    const historyService = new BotMessageHistory({
      stateService,
      tableName,
    });

    return new Bot({
      promptService,
      command,
      allowedChats,
      historyService,
      telegramToken,
      defaultResponse,
      telegramBotOptions,
      endOfConversationFn,
    });
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
   * @returns {Promise<BotConversationResult | void>} - conversation result returned only if the message is a JSON object
   */
  private async respond(
    messageInfo: BotMessageInfo
  ): Promise<BotConversationResult | void> {
    const { userId, messageId, username, text, chatId } = messageInfo;

    try {
      const history = await this.historyManager.getHistoryById(String(userId));

      // Get the response from OpenAI
      const newHistory = await this.promptService.makePrompt(
        username,
        text,
        history
      );
      const lastLLMMessage = this.historyManager.getLastMessage(newHistory);

      log(FROM.BOT, TYPE.INFO, "LLM response:", lastLLMMessage);

      // Check if the response is a JSON object which marks the end of the conversation
      const result = lastLLMMessage?.match(/^(\{.+\})$/m)?.[0];
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
    const bot = await this.getBotInfo();

    const isAllowedChat = !!this.allowedChats?.includes(String(chatId));
    const isAddressingBot =
      message.text?.includes(this.command) ||
      message.reply_to_message?.from?.username === bot?.username;

    const text =
      (isAddressingBot
        ? message.text
        : message.text?.split(this.command)[1]?.trim()) || "";

    console.log("isAddressingBot", isAddressingBot, text);
    const username = message.from?.username || message.from?.first_name || "";
    const isBot = !!message.from?.is_bot;
    const mention = (!!username ? "@" : "") + username;

    return {
      messageId,
      username,
      mention,
      userId,
      text,
      chatId,
      isBot,
      isAllowedChat,
      isAddressingBot,
    };
  }

  /**
   * Validates the message according to given rules
   * @param {TelegramBot.Message} message - received user message
   * @returns {boolean} - true if the message is valid
   */
  private async getValidMessage(
    message: TelegramBot.Message
  ): Promise<BotMessageInfo> {
    const messageInfo = await this.getMessageInfo(message);
    const { userId, text, isBot, isAllowedChat, isAddressingBot } = messageInfo;
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
    callback: (
      result: BotConversationResult,
      messageInfo: BotMessageInfo,
      instance: Bot
    ) => void | Promise<void>
  ): Promise<BotConversationResult | void> {
    log(FROM.BOT, TYPE.INFO, "Message received:", message);

    const validMessage = await this.getValidMessage(message);
    const botInfo = await this.getBotInfo();
    if (!validMessage) return;

    const { text, chatId } = validMessage;

    const isHelpNeeded =
      !text ||
      text.match(/help/i) ||
      text.match(/start/i) ||
      text === this.command ||
      text === `${this.command}@${botInfo?.username}`;

    if (isHelpNeeded) {
      this.telegramBot.sendMessage(chatId, this.defaultResponse);
      return;
    }

    // Start a conversation with the user
    try {
      const result = await this.respond(validMessage);
      log(FROM.BOT, TYPE.INFO, "Conversation result:", result);
      if (result) {
        return callback(result, validMessage, this);
      }
    } catch (err) {
      log(FROM.BOT, TYPE.ERROR, "Conversation error:", err);
    }

    log(FROM.BOT, TYPE.SUCCESS, "Message processed");
    return;
  }

  public getTelegramBot(): TelegramBot {
    return this.telegramBot;
  }

  public onMessage(callback: (...args: any) => void) {
    if (this.telegramBot.isPolling()) {
      this.telegramBot.on("message", async (message) => {
        this.processMessage(message, async (result, meta) => {
          callback(result, meta);
        });
      });
    } else {
      log(FROM.BOT, TYPE.ERROR, "Bot is not polling");
    }
  }
}
