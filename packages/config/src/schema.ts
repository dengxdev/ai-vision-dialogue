import { z } from 'zod';

/**
 * 从环境变量字符串解析 boolean（true/1 视为 true，其余视为 false）
 */
const envBoolean = (defaultValue = false) =>
  z.preprocess(
    (val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        return lower === 'true' || lower === '1';
      }
      return defaultValue;
    },
    z.boolean().default(defaultValue),
  );

/**
 * 前后端共享的完整环境变量 schema
 *
 * 注意：VISION_API_KEY / LLM_API_KEY 等敏感字段仅供 BFF 使用，
 * 前端应通过 webConfigSchema 解析非敏感子集，避免将密钥打包到浏览器。
 */
export const envSchema = z.object({
  // 视觉模型（BFF 使用）
  VISION_API_KEY: z.string().default(''),
  VISION_API_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
  VISION_MODEL: z
    .enum([
      'qwen-vl-max',
      'qwen-vl-plus',
      'qwen-vl-plus-latest',
      'gpt-4o',
      'gemini-pro-vision',
    ])
    .default('qwen-vl-max'),
  ENABLE_MOCK_VISION: envBoolean(true),

  // 文本模型（BFF 使用）
  LLM_API_KEY: z.string().default(''),
  LLM_API_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
  LLM_MODEL: z.string().min(1).default('qwen-turbo'),
  ENABLE_MOCK_LLM: envBoolean(true),

  // 端侧图像压缩与成本控制
  FRAME_MAX_WIDTH: z.coerce.number().default(512),
  FRAME_QUALITY: z.coerce.number().min(0).max(1).default(0.7),
  ENABLE_CHANGE_DETECTION: envBoolean(true),
  ENABLE_VISION_FALLBACK: envBoolean(true),
  MAX_HISTORY_ROUNDS: z.coerce.number().default(10),

  // BFF 服务端
  BFF_PORT: z.coerce.number().default(3000),
  BFF_CORS_ORIGIN: z.string().default('*'),
  WS_NAMESPACE: z.string().default('video'),

  // BFF 限流
  ENABLE_RATE_LIMIT: envBoolean(true),
  RPM_LIMIT: z.coerce.number().default(60),

  // 运行环境
  APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
});

/**
 * 前端仅暴露非敏感字段，避免泄露 API Key
 */
export const webConfigSchema = envSchema
  .pick({
    FRAME_MAX_WIDTH: true,
    FRAME_QUALITY: true,
    ENABLE_CHANGE_DETECTION: true,
    ENABLE_VISION_FALLBACK: true,
    MAX_HISTORY_ROUNDS: true,
    APP_ENV: true,
    WS_NAMESPACE: true,
  })
  .extend({
    BFF_WS_URL: z.string().url(),
  });

export type Config = z.infer<typeof envSchema>;
export type WebConfig = z.infer<typeof webConfigSchema>;
