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

export type BotConversationResult = {
  resolution: "book" | "cancel" | "check";
  date: string;
  time: string | undefined;
  name: string;
  people: string | undefined;
};

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

type BotConfig = {
  promptService: PromptServiceInterface<unknown>;
  historyService: HistoryManagerInterface<unknown>;
  telegramToken: string;
  allowedChats: string[];
  command: string;
  defaultResponse: string;
  telegramBotOptions: TelegramBot.ConstructorOptions;
  endOfConversationFn: (message: string) => any;
};

export type BotCreateConfig = {
  command: string;
  openAIKey: string;
  dynamoDBTableName: string;
  allowedChats: string[];
  telegramToken: string;
  defaultResponse: string;
  systemPromptFunc: (username?: string) => string;
  model: ChatCompletionCreateParams["model"];
  endOfConversationFn: (message: string) => any;
  telegramBotOptions?: TelegramBot.ConstructorOptions;
};

export class Bot {
  private telegramBot: TelegramBot;
  private historyManager: HistoryManagerInterface<unknown>;
  private promptService: PromptServiceInterface<unknown>;
  private allowedChats: string[];
  private command: string;
  private botInfo: TelegramBot.User | null = null;
  private endOfConversationFn: (message: string) => any;
  private defaultResponse: string = "";

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
      messageInfo: BotMessageInfo
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
        return callback(result, validMessage);
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
