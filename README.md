# NotVerySmartBot

## Description

Library to help develop Telegram bot that operates with AI providers (OpenAI and Google Gemini) and provides utilities to create publishable AWS Lambda.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Installation

`npm i --save-dev nvsbot-beta`

## Usage

`DevServer` and `Bot.createBot` provide a convenient way to setup bot environment via providing config. The bot supports multiple AI providers:

- **OpenAI** - GPT models (gpt-3.5-turbo, gpt-4, etc.)
- **Google Gemini** - Gemini models (gemini-pro, gemini-pro-vision, etc.)

Choose your preferred provider using the `provider` configuration option. The `Bot` class allows for more advanced customization, such as providing your own state management class if DynamoDB is not desired.

### Local development

Create executable .js file which will be run by `node`. Library provides `DevServer` class which will start development server. Endpoint `/webhook` will be created for dev server, which accepts POST requests.
Example of such executable file:

```javascript
import "dotenv/config";
import { DevServer } from "./server/DevServer";
import moment from "moment";
import TelegramBot from "node-telegram-bot-api";

const telegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN || "", {
  polling: true,
});

// Example with OpenAI
new DevServer({
  command: "/command",
  provider: "openai",
  openAIKey: process.env.OPENAI_API_KEY || "",
  dynamoDBTableName: process.env.TABLE_NAME || "",
  allowedChats: process.env.ALLOWED_CHAT_ID?.split(",") || [],
  defaultResponse: "Help message",
  model: "gpt-3.5-turbo-16k-0613",
  telegramBot,
  endOfConversationFn: (message): { a: string } | void => {
    if (message.match(/^\{.*\}$/)) {
      return JSON.parse(message) as { a: string };
    }
  },
  systemPromptFunc: (username = `undefined`) => {
    const dayToday = moment().format("dddd");
    const dateToday = new Date().toLocaleDateString("uk-UA");
    return "System prompt that returns JSON in the end of conversation";
  },
}).onMessage(async (message, bot) => {
  const result = await bot.processMessage(message);
  if (result) {
    const parsedResult = JSON.parse(result);
    console.log(parsedResult);
  }
});

// Example with Google Gemini
new DevServer({
  command: "/command",
  provider: "gemini",
  geminiKey: process.env.GEMINI_API_KEY || "",
  dynamoDBTableName: process.env.TABLE_NAME || "",
  allowedChats: process.env.ALLOWED_CHAT_ID?.split(",") || [],
  defaultResponse: "Help message",
  model: "gemini-pro",
  telegramBot,
  endOfConversationFn: (message): { a: string } | void => {
    if (message.match(/^\{.*\}$/)) {
      return JSON.parse(message) as { a: string };
    }
  },
  systemPromptFunc: (username = `undefined`) => {
    const dayToday = moment().format("dddd");
    const dateToday = new Date().toLocaleDateString("uk-UA");
    return "System prompt that returns JSON in the end of conversation";
  },
}).onMessage(async (message, bot) => {
  const result = await bot.processMessage(message);
  if (result) {
    const parsedResult = JSON.parse(result);
    console.log(parsedResult);
  }
});
```

### Configuration Options

The bot configuration supports the following provider options:

#### Required for all providers:

- `command` - The command that triggers the bot (e.g., "/command")
- `provider` - AI provider to use: `"openai"` or `"gemini"`
- `allowedChats` - Array of allowed chat IDs
- `defaultResponse` - Default help message
- `model` - AI model to use
- `telegramBot` - Telegram bot instance
- `endOfConversationFn` - Function to handle conversation end
- `systemPromptFunc` - Function to generate system prompts

#### Provider-specific options:

**For OpenAI (`provider: "openai"`):**

- `openAIKey` - Your OpenAI API key
- `model` examples: `"gpt-3.5-turbo"`, `"gpt-4"`, `"gpt-3.5-turbo-16k-0613"`

**For Gemini (`provider: "gemini"`):**

- `geminiKey` - Your Google Gemini API key
- `model` examples: `"gemini-pro"`, `"gemini-pro-vision"`

#### Optional:

- `dynamoDBTableName` - DynamoDB table for message history (uses local storage if not provided)

Setup webhook for your bot:

```text
https://api.telegram.org/bot<bot-token>/setWebhook?url=https://<your-host>/webkook
```

### Deploying WebHook bot to AWS Lambda

IMPORTANT: Lambda function should send instant response to Telegram service about receiving message.
This is achieved by creating proxy lambda which after sending response invokes Lambda function with actual bot functionality.

Example of proxy `index.js` handler for proxy Lambda:

```javascript
import { Handler } from "nvsbot-beta";

export const handler = Handler.createProxyLambda({
  mainLambdaName: "Your main lambda name",
});
```

Example of `index.js` handler for actual bot Lambda:

```javascript
import { Bot, Handler } from "nvsbot-beta";
import TelegramBot from "node-telegram-bot-api";

const telegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN || "", {
  webHook: true,
});

export const handler = Handler.createMainLambda(async (message) => {
  const bot = Bot.createBot(/* configuration */);
  const result = await bot.processMessage(message);
  /* process the result of conversation */
});
```

## Contributing

Contribute by posting issues or ideas to [GitHub Issues](https://github.com/TJNYL/NVSBot/issues).

## License

[APACHE LICENSE, VERSION 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)
