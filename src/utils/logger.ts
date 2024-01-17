export enum FROM {
  LAMBDA = "Lambda",
  BOT = "Bot",
  OPEN_AI = "OpenAI",
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

export const log = (from: FROM, type: TYPE, ...messages: any[]) => {
  console[type === TYPE.ERROR ? "error" : "info"](
    `${from}:${type}:`,
    ...messages
  );
};
