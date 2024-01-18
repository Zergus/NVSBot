import {
  DynamoDBClient,
  DynamoDBClientConfig,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { StateServiceInterface } from "./StateServiceInterface";
import moment from "moment";
import OpenAI from "openai";

/**
 * Configuration options for DynamoDBService.
 */
export type DynamoDBServiceConfig = {
  /**
   * The name of the DynamoDB table.
   */
  tableName: string;
  /**
   * Additional configuration options for DynamoDBService.
   */
  config?: DynamoDBServiceConfig;
};

/**
 * Represents a service for interacting with DynamoDB.
 */
export class DynamoDBService
  implements
    StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private dynamoDBClient: DynamoDBClient;
  private tableName: string;

  /**
   * Constructs a new instance of the DynamoDBService class.
   * @param {DynamoDBServiceConfig} options - The configuration options for the service.
   */
  constructor({ tableName, config }: DynamoDBServiceConfig) {
    this.dynamoDBClient = new DynamoDBClient(config || {});
    this.tableName = tableName;
    return this;
  }

  /**
   * Retrieves an item from DynamoDB by its ID.
   * @param {string} id - The ID of the item to retrieve.
   * @returns {Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>} A promise that resolves to an array of chat completion messages.
   */
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

  /**
   * Sets an item in DynamoDB by its ID.
   * @param {string} id - The ID of the item to set.
   * @param {OpenAI.Chat.Completions.ChatCompletionMessageParam[]} update - The chat completion messages to set.
   * @returns {Promise<void>} A promise that resolves when the item is set successfully.
   */
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
