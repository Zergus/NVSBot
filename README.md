# NotVerySmartBot

## Description

Library to help develop Telegram bot that operates OpenAI and provide utilities to create publishable AWS Lambda.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Installation

`npm i --save-dev nvsbot-beta`

## Usage

`DevServer` and `Bot.createBot` provide convenient way to setup bot environment via providing config. Otherwise, `Bot` class allows for more advanced customization, eg. providing own state management class, if DynamoDB is not desired tool.

### Local development

Create executable .js file which will be run by `node`. Library provides `DevServer` class which will start development server. Endpoint `/webhook` will be created for dev server, which accepts POST requests.
Example of such executable file:

```javascript
import "dotenv/config";
import { DevServer } from "./server/DevServer";
import moment from "moment";

new DevServer({
  command: "/command",
  openAIKey: process.env.OPENAI_API_KEY,
  dynamoDBTableName: process.env.TABLE_NAME,
  allowedChats: process.env.ALLOWED_CHAT_ID,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  defaultResponse: "Help message",
  telegramBotOptions: {
    polling: true,
  },
  model: "gpt-3.5-turbo-16k-0613",
  endOfConversationFn: (message) => {
    if (message.match(/^\{.*\}$/)) {
      return message;
    }
  },
  systemPromptFunc: (username = `undefined`) => {
    const dayToday = moment().format("dddd");
    const dateToday = new Date().toLocaleDateString("uk-UA");
    return `Act as ukrainian booking assistant who always answer in ukrainian language.
          You answer only to booking requests in short manner.
          You succeed if you book or cancel booking.
          Requests are made for name "${username}". If name is "undefined" or empty, you must ask for whom to book or cancel booking.
          You always address me by name.
          Today is ${dayToday}, ${dateToday}.
          Booking can be made only for open days between open hours. Eg. I can not book for 9pm since we close at 9pm.
          Open days are Thursday, Friday, Saturday or Sunday.
          Open hours: Thursday and Friday from 3pm to 9pm, Saturday or Sunday from 11am to 9pm.
          For checking available tables, I must provide date in format "dd.mm".
          For cancellation, I must provide date in format "dd.mm".
          For booking I must provide date in format "dd.mm", number of people (up to 6), and time within working hours for given date.
          If I miss something, you should ask for it.
          You must always ask for my confirmation before booking or cancelling.
          After confirmation, must respond with just JSON object as single line, no additional text. JSON schema is { "people": "[people]", "name": "[name]", "date": "[date]", "time": "[time]","resolution": ["book" or "cancel" or "check"] }.`;
  },
}).onMessage(async (message, bot) => {
  const result = await bot.processMessage(message);
  const parsedResult = JSON.parse(result);
  /* process the result of conversation */
});
```

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
