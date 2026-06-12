import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import type { ServerInferResponses } from '@ts-rest/core';
import { apiContract, type ApiContract } from '@ai-vision/contract';
import { DialogueService } from './dialogue.service';

type ChatResponse = ServerInferResponses<ApiContract['chat']>;
type ChatHandler = (args: {
  body: {
    sessionId: string;
    message: string;
    visualContext?: string;
    history?: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: number }[];
  };
}) => Promise<ChatResponse>;

@Controller()
export class DialogueController {
  constructor(private readonly dialogueService: DialogueService) {}

  @TsRestHandler(apiContract.chat)
  async chat(): Promise<ChatHandler> {
    return tsRestHandler<ApiContract['chat']>(
      apiContract.chat,
      async ({ body }) => {
        const result = await this.dialogueService.chat(body);

        return {
          status: 200 as const,
          body: result,
        };
      },
    ) as ChatHandler;
  }
}
