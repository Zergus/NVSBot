import "dotenv/config";
import { DevServer } from "./server/DevServer";
import moment from "moment";

new DevServer({
  command: "/nora",
  openAIKey: process.env.OPENAI_API_KEY || "",
  dynamoDBTableName: process.env.TABLE_NAME || "",
  allowedChats: process.env.ALLOWED_CHAT_ID?.split(",") || [],
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  defaultResponse: "Help message",
  telegramBotOptions: {
    polling: true,
  },
  model: "gpt-3.5-turbo-16k-0613",
  endOfConversationFn: (message) => {
    if (message.match(/^\{.*\}$/)) {
      return JSON.parse(message);
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
}).onMessage((message) => {
  console.log("Message received:", message);
});
