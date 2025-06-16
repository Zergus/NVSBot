export enum FROM {
  LAMBDA = "Lambda",
  BOT = "Bot",
  OPEN_AI = "OpenAI",
  GEMINI = "Gemini",
  GOOGLE_SHEETS = "GoogleSheets",
  DYNAMO_DB = "DynamoDB",
  HISTORY = "History",
  PROXY = "Proxy",
  SERVER = "Server",
}

export enum TYPE {
  INFO = "INFO",
  ERROR = "ERROR",
  SUCCESS = "SUCCESS",
}

/**
 * Logs messages with the specified log level and origin.
 * @param from The origin of the log message.
 * @param type The log level (error or info).
 * @param messages The messages to be logged.
 */
export const log = (from: FROM, type: TYPE, ...messages: any[]) => {
  console[type === TYPE.ERROR ? "error" : "info"](
    `${from}:${type}:`,
    ...messages
  );
};
