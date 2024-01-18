import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Message } from "node-telegram-bot-api";
import { FROM, TYPE, log } from "../utils/logger";
import { Lambda } from "aws-sdk";

/**
 * Represents a handler class that creates lambda functions.
 */
export class Handler {
  /**
   * Creates a main lambda function.
   * @param callback - The callback function to be executed by the lambda.
   * @returns An async function that represents the main lambda.
   */
  static createMainLambda(
    callback: (
      message: Message,
      event?: APIGatewayProxyEvent
    ) => void | Promise<void>
  ) {
    return async (
      event: APIGatewayProxyEvent
    ): Promise<APIGatewayProxyResult> => {
      log(FROM.LAMBDA, TYPE.INFO, "Start");
      const webhookRequest = JSON.parse(event?.body || "{}");

      if (!webhookRequest?.message) {
        log(FROM.LAMBDA, TYPE.ERROR, "No message");
        return {
          statusCode: 200,
          body: "No message",
        };
      }

      try {
        await callback(webhookRequest?.message, event);
      } catch (err) {
        log(FROM.LAMBDA, TYPE.ERROR, `${err}`);
        return {
          statusCode: 200,
          body: "Error",
        };
      }

      log(FROM.LAMBDA, TYPE.SUCCESS, "Completed");

      return {
        statusCode: 200,
        body: "Completed",
      };
    };
  }

  /**
   * Creates a proxy lambda function.
   * @param mainLambdaName - The name of the main lambda function to be invoked.
   * @returns An async function that represents the proxy lambda.
   */
  static createProxyLambda({ mainLambdaName }: { mainLambdaName: string }) {
    return async (
      event: APIGatewayProxyEvent
    ): Promise<APIGatewayProxyResult> => {
      const lambda = new Lambda();
      log(FROM.LAMBDA, TYPE.INFO, "Invoking proxy:", event);

      if (!mainLambdaName) {
        log(FROM.LAMBDA, TYPE.ERROR, "Lambda name not found");
        return {
          statusCode: 500,
          body: "Lambda name not found",
        };
      }

      try {
        await lambda
          .invoke({
            FunctionName: mainLambdaName,
            InvocationType: "Event",
            Payload: JSON.stringify(event),
          })
          .promise();
      } catch (err) {
        log(FROM.LAMBDA, TYPE.ERROR, `${err}`);
        return {
          statusCode: 500,
          body: JSON.stringify(err),
        };
      }

      return {
        statusCode: 200,
        body: "",
      };
    };
  }
}
