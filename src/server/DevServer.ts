import bodyParser from "body-parser";
import express from "express";
import { Bot, BotCreateConfig } from "../core/Bot";
import { FROM, TYPE, log } from "../utils/logger";

/**
 * Represents a development server for handling incoming messages.
 */
export class DevServer {
  private bot: Bot;

  /**
   * Creates a new instance of the DevServer class.
   * @param botConfig - The configuration for creating the bot.
   */
  constructor(botConfig: BotCreateConfig) {
    this.bot = Bot.createBot(botConfig);
    return this;
  }

  /**
   * Sets up the message event handler and starts the server.
   * @param callback - The callback function to be executed when a message is received.
   */
  public onMessage(callback: (...args: any) => void) {
    if (this.bot.getTelegramBot().isPolling()) {
      log(FROM.SERVER, TYPE.INFO, "Starting polling server");
      this.startPollingServer(callback);
    } else {
      log(FROM.SERVER, TYPE.INFO, "Starting webhook server");
      this.startWebhookServer(callback);
    }
  }

  /**
   * Starts the polling server and sets up the message event handler.
   * @param callback - The callback function to be executed when a message is received.
   */
  private startPollingServer(callback: (...args: any) => void) {
    this.bot.onMessage(callback);
  }

  /**
   * Starts the webhook server and sets up the message event handler.
   * @param callback - The callback function to be executed when a message is received.
   */
  private startWebhookServer(callback: (...args: any) => void) {
    const app = express();
    const port = process.env.LOCAL_PORT;

    app.use(bodyParser.json());

    /**
     * Handles incoming webhook requests
     *
     * @param req - The incoming request object
     * @param res - The response object
     */
    app.post("/webhook", (req: any, res: any) => {
      const { message } = req.body;
      this.bot.processMessage(message, callback);
      res.status(200).send("Acknowledged");
    });

    app.listen(port, () => {
      console.info(`Webhook server is listening at https://localhost:${port}`);
    });
  }
}
