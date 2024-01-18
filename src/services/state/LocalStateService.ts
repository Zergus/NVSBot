import { StateServiceInterface } from "./StateServiceInterface";
import OpenAI from "openai";

export type LocalState = {
  id: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}[];

export class LocalStateService
  implements
    StateServiceInterface<OpenAI.Chat.Completions.ChatCompletionMessageParam>
{
  private localState: LocalState = [];

  constructor() {
    return this;
  }

  public async getItemById(
    id: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    return this.localState.find((state) => state.id === id)?.messages || [];
  }

  public async setItemById(
    id: string,
    update: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): Promise<void> {
    const item = this.localState.find((state) => state.id === id);
    if (item) {
      item.messages = update;
    } else {
      this.localState.push({ id, messages: update });
    }
    return;
  }
}
