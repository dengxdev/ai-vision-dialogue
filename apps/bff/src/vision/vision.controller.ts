import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import type { ServerInferResponses } from '@ts-rest/core';
import { apiContract, type ApiContract } from '@ai-vision/contract';
import { VisionService } from './vision.service';

type AnalyzeFrameResponse = ServerInferResponses<ApiContract['analyzeFrame']>;
type AnalyzeFrameHandler = (args: {
  body: {
    sessionId: string;
    frame: { id: string; data: string };
    prompt: string;
  };
}) => Promise<AnalyzeFrameResponse>;

@Controller()
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @TsRestHandler(apiContract.analyzeFrame)
  async analyzeFrame(): Promise<AnalyzeFrameHandler> {
    return tsRestHandler<ApiContract['analyzeFrame']>(
      apiContract.analyzeFrame,
      async ({ body }) => {
        const { frame, prompt, sessionId } = body;

        const result = await this.visionService.analyze({
          frameId: frame.id,
          imageBase64: frame.data,
          prompt,
          context: [
            {
              role: 'system',
              content: `当前会话 ID: ${sessionId}。请基于画面内容回答。`,
            },
          ],
        });

        return {
          status: 200 as const,
          body: {
            text: result.description,
            objects: [],
            costTokens: result.tokensUsed,
          },
        };
      },
    ) as AnalyzeFrameHandler;
  }
}
