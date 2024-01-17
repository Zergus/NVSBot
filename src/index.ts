import { Handler } from "./lambda/Handler";
// import { Bot } from "./core/Bot";

export const handler = Handler.createMainLambda(async (message) => {
  // const bot = Bot.createBot({
  //   command: "Your command, eg. /bot",
  //   openAIKey: "Your openAI key",
  //   dynamoDBTableName: "Your DB table name",
  //   allowedChats: "List of allowed chat ids, eg. [123,456]",
  //   telegramToken: "Your telegram token",
  //   defaultResponse: "Default response for /help command",
  //   model: "Your GPT model, eg. gpt-4",
  //   systemPromptFunc: (username) => {
  //     return `
  //        Your default system prompt to configure GPT model.
  //        After conversation, bot must return JSON object which will indicate end of conversation.`;
  //   },
  //   telegramBotOptions: {}, // Telegram Bot options
  // });
  // await bot.processMessage(message, async (result, meta) => {
  //   const telegramBot = bot.getTelegramBot();
  //   console.log("Result:", result);
  // });
});
