import { z } from 'zod';

/**
 * 前后端共享的基础环境变量 schema
 */
export const sharedEnvSchema = z.object({
  BFF_PORT: z.coerce.number().default(3000),
  WS_NAMESPACE: z.string().default('/vision'),
  COST_MAX_IMAGE_SIZE: z.coerce.number().default(512),
  COST_JPEG_QUALITY: z.coerce.number().default(0.7),
  COST_MAX_RPM: z.coerce.number().default(60),
});

/**
 * BFF 服务端环境变量 schema
 */
export const bffEnvSchema = sharedEnvSchema.extend({
  VISION_API_KEY: z.string().min(1, 'VISION_API_KEY is required'),
  VISION_BASE_URL: z.string().url(),
  VISION_MODEL: z.string().min(1),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_BASE_URL: z.string().url(),
  LLM_MODEL: z.string().min(1),
});

/**
 * 前端环境变量 schema
 */
export const webEnvSchema = z.object({
  BFF_WS_URL: z.string().url(),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type BffEnv = z.infer<typeof bffEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
