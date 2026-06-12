import { envSchema, webConfigSchema } from './schema';

export * from './schema';

export interface RuntimeStrategy {
  frameMaxWidth: number;
  quality: number;
  rpmLimit: number;
}

/**
 * 解析完整环境变量（供 BFF 使用）
 * 缺少必需变量时会抛出 ZodError，阻止服务启动
 */
export function createConfig(env: Record<string, unknown>) {
  return envSchema.parse(env);
}

/**
 * 解析前端非敏感环境变量（供 web 使用）
 */
export function createWebConfig(env: Record<string, unknown>) {
  return webConfigSchema.parse(env);
}

/**
 * 获取当前运行时的成本控制策略
 *
 * production 下自动降级：更小分辨率、更低 JPEG 质量、更严格 RPM
 */
export function getRuntimeStrategy(config: { APP_ENV: string }): RuntimeStrategy {
  if (config.APP_ENV === 'production') {
    return {
      frameMaxWidth: 384,
      quality: 0.6,
      rpmLimit: 30,
    };
  }

  return {
    frameMaxWidth: 512,
    quality: 0.7,
    rpmLimit: 60,
  };
}
