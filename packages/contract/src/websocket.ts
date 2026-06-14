import { z } from 'zod';

const tokensUsedSchema = z.object({
  input: z.number().int().min(0),
  output: z.number().int().min(0),
});

const dialogueHistorySchema = z.array(
  z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  }),
);

// Client -> BFF
export const framePayloadSchema = z.object({
  frameId: z.string(),
  imageBase64: z.string(),
  timestamp: z.number(),
  perceptualHash: z.string().optional(),
  changeScore: z.number().optional(),
});

export const dialoguePayloadSchema = z.object({
  message: z.string(),
  frame: z
    .union([z.object({ imageBase64: z.string() }), z.null()])
    .optional(),
  history: dialogueHistorySchema.optional(),
});

// BFF -> Client
export const frameResultSchema = z.object({
  frameId: z.string(),
  description: z.string(),
  tokensUsed: z.union([z.number().int().min(0), tokensUsedSchema]).optional(),
  fromCache: z.boolean().optional(),
});

export const frameSkippedSchema = z.object({
  frameId: z.string(),
  reason: z.string(),
});

export const frameRateLimitedSchema = z.object({
  frameId: z.string(),
});

export const frameErrorSchema = z.object({
  frameId: z.string(),
  error: z.string(),
});

export const dialogueResultSchema = z.object({
  reply: z.string(),
  usage: z.union([z.number().int().min(0), tokensUsedSchema]).optional(),
  // 保留现有 BFF 返回的明细字段，便于前端做成本展示
  visionUsage: z.number().int().min(0).optional(),
  visionPromptTokens: z.number().int().min(0).optional(),
  visionCompletionTokens: z.number().int().min(0).optional(),
  llmUsage: z.number().int().min(0).optional(),
  llmPromptTokens: z.number().int().min(0).optional(),
  llmCompletionTokens: z.number().int().min(0).optional(),
  visionFromCache: z.boolean().optional(),
});

export const dialogueErrorSchema = z.object({
  message: z.string(),
});

export const costMetricsPayloadSchema = z.object({
  apiCalls: z.number().int().min(0),
  visionCalls: z.number().int().min(0),
  llmCalls: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  estimatedCostCny: z.number(),
  rpm: z.number(),
  windowStart: z.number(),
  framesCaptured: z.number().int().min(0),
  framesSkipped: z.number().int().min(0),
  cacheHits: z.number().int().min(0),
  avgResponseMs: z.number(),
});

export type FramePayload = z.infer<typeof framePayloadSchema>;
export type DialoguePayload = z.infer<typeof dialoguePayloadSchema>;
export type FrameResult = z.infer<typeof frameResultSchema>;
export type FrameSkipped = z.infer<typeof frameSkippedSchema>;
export type FrameRateLimited = z.infer<typeof frameRateLimitedSchema>;
export type FrameError = z.infer<typeof frameErrorSchema>;
export type DialogueResult = z.infer<typeof dialogueResultSchema>;
export type DialogueError = z.infer<typeof dialogueErrorSchema>;
export type CostMetricsPayload = z.infer<typeof costMetricsPayloadSchema>;

export const WebSocketEvents = {
  // Client -> BFF
  Frame: 'frame',
  Dialogue: 'dialogue',
  Metrics: 'metrics',

  // BFF -> Client
  FrameResult: 'frame:result',
  FrameSkipped: 'frame:skipped',
  FrameRateLimited: 'frame:rate-limited',
  FrameError: 'frame:error',
  FrameTier: 'frame:tier',
  DialogueResult: 'dialogue:result',
  DialogueError: 'dialogue:error',
  MetricsResult: 'metrics:result',
  Error: 'error',
} as const;
