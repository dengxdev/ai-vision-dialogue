import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type {
  CapturedFrame,
  VisionResponse,
  MultimodalInput,
  DialogueResponse,
  CostMetrics,
} from '@ai-vision/shared';

export * from './websocket';

const c = initContract();

export const apiContract = c.router({
  analyzeFrame: {
    method: 'POST',
    path: '/vision/analyze-frame',
    body: z.object({
      sessionId: z.string(),
      frame: z.custom<CapturedFrame>((val) => val !== undefined, {
        message: 'frame is required',
      }),
      prompt: z.string().default('描述画面内容'),
    }),
    responses: {
      200: z.custom<VisionResponse>(),
    },
    summary: 'Analyze a single video frame',
  },
  chat: {
    method: 'POST',
    path: '/dialogue/chat',
    body: z.custom<MultimodalInput>((val) => val !== undefined, {
      message: 'input is required',
    }),
    responses: {
      200: z.custom<DialogueResponse>(),
    },
    summary: 'Multimodal chat endpoint',
  },
  getMetrics: {
    method: 'GET',
    path: '/metrics',
    responses: {
      200: z.custom<CostMetrics>(),
    },
    summary: 'Get cost metrics',
  },
});

export type ApiContract = typeof apiContract;
