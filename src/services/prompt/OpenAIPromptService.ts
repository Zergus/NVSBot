import OpenAI from "openai";
import { PromptServiceInterface } from "./PromptServiceInterface";
import moment from "moment";
import { FROM, TYPE, log } from "../../utils/logger";

type OpenAIPromptServiceConfig = {
  openai: OpenAI;
  systemPromptFunc: (username: string) => string;
};

export class OpenAIPromptService
  implements
    PromptServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private openai: OpenAI;
  private systemPromptFunc: (username: string) => string;

  constructor({ openai, systemPromptFunc }: OpenAIPromptServiceConfig) {
    this.openai = openai;
    this.systemPromptFunc = systemPromptFunc;
    return this;
  }

  // /**
  //  * Retrieves the system prompt for the Ukrainian booking assistant.
  //  *
  //  * @param username - The name of the user making the booking request.
  //  * @returns The system prompt for the Ukrainian booking assistant.
  //  */
  // private getSystemPrompt = (username = `undefined`) => {
  //   const dayToday = moment().format("dddd");
  //   const dateToday = new Date().toLocaleDateString("uk-UA");
  //   const name = username.replace(/[^a-zA-Z0-9]/g, " ");
  //   return `Act as ukrainian booking assistant who always answer in ukrainian language.
  //     You answer only to booking requests in short manner.
  //     You succeed if you book or cancel booking.
  //     Requests are made for name "${username}". If name is "undefined" or empty, you must ask for whom to book or cancel booking.
  //     You always address me by name.
  //     Today is ${dayToday}, ${dateToday}.
  //     Booking can be made only for open days between open hours. Eg. I can not book for 9pm since we close at 9pm.
  //     Open days are Thursday, Friday, Saturday or Sunday.
  //     Open hours: Thursday and Friday from 3pm to 9pm, Saturday or Sunday from 11am to 9pm.
  //     For checking available tables, I must provide date in format "dd.mm".
  //     For cancellation, I must provide date in format "dd.mm".
  //     For booking I must provide date in format "dd.mm", number of people (up to 6), and time within working hours for given date.
  //     If I miss something, you should ask for it.
  //     You must always ask for my confirmation before booking or cancelling.
  //     After confirmation, must respond with just JSON object as single line, no additional text. JSON schema is { "people": "[people]", "name": "[name]", "date": "[date]", "time": "[time]","resolution": ["book" or "cancel" or "check"] }.`;
  // };

  /**
   * Makes a prompt for OpenAI chat completions.
   *
   * @param username - The username of the user.
   * @param userInput - The user's input.
   * @param messages - The array of chat messages.
   * @returns A promise that resolves to an array of chat messages.
   */
  public async makePrompt(
    username: string,
    userInput: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    log(FROM.OPEN_AI, TYPE.INFO, username, userInput);
    if (!messages.length) {
      messages.push({
        role: "system",
        content: this.systemPromptFunc(username),
      });
    }
    messages.push({
      role: "user",
      content: userInput,
      name: username || String(Date.now()),
    });
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
        max_tokens: 200,
        temperature: 0,
      });
      messages.push(response?.choices?.[0].message);
      log(FROM.OPEN_AI, TYPE.INFO, response?.choices?.[0]?.message.content);
      return messages;
    } catch (err) {
      log(FROM.OPEN_AI, TYPE.ERROR, err);
      return messages;
    }
  }
}
