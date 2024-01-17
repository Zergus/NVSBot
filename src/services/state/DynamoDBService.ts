import {
  DynamoDBClient,
  DynamoDBClientConfig,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { StateServiceInterface } from "./StateServiceInterface";
import moment from "moment";
import OpenAI from "openai";

type DynamoDBServiceConfig = {
  tableName: string;
  config?: DynamoDBServiceConfig;
};

type LocalHistory = {
  id: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
};

export class DynamoDBService
  implements
    StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private dynamoDBClient: DynamoDBClient;
  private tableName: string;

  constructor({ tableName, config }: DynamoDBServiceConfig) {
    this.dynamoDBClient = new DynamoDBClient(config || {});
    this.tableName = tableName;
    return this;
  }

  public async getItemById(
    id: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const historyResponse = await this.dynamoDBClient.send(
      new GetItemCommand({
        ConsistentRead: true,
        TableName: this.tableName,
        Key: {
          id: { S: id },
        },
      })
    );
    return (
      historyResponse.Item?.messages.L?.map((msg) =>
        !!msg?.M?.message?.S ? JSON.parse(msg.M.message.S) : {}
      ) || []
    );
  }

  public async setItemById(
    id: string,
    update: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): Promise<void> {
    const deleteIn5Minutes = moment().add(5, "minutes").unix();
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          id: { S: id },
          messages: {
            L: update.map((message, index) => ({
              M: {
                id: { N: String(index) },
                message: { S: JSON.stringify(message) },
              },
            })),
          },
          timestamp: { N: String(deleteIn5Minutes) },
        },
      })
    );
  }
}
