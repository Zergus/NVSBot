import bodyParser from "body-parser";
import express from "express";
import { Bot, BotCreateConfig } from "../core/Bot";
import { FROM, TYPE, log } from "../utils/logger";

export class DevServer {
  private bot: Bot;
  constructor(botConfig: BotCreateConfig) {
    this.bot = Bot.createBot(botConfig);
  }

  public onMessage(callback: (...args: any) => void) {
    if (this.bot.getTelegramBot().isPolling()) {
      log(FROM.SERVER, TYPE.INFO, "Starting polling server");
      this.startPollingServer(callback);
    } else {
      log(FROM.SERVER, TYPE.INFO, "Starting webhook server");
      this.startWebhookServer(callback);
    }
  }

  private startPollingServer(callback: (...args: any) => void) {
    this.bot.onMessage(callback);
  }

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
      callback(message);
      res.status(200).send("Acknowledged");
    });

    app.listen(port, () => {
      console.info(`Webhook server is listening at https://localhost:${port}`);
    });
  }
}
