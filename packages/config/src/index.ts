import {
  bffEnvSchema,
  sharedEnvSchema,
  webEnvSchema,
} from './schema';

export * from './schema';

export interface RuntimeStrategy {
  maxImageSize: number;
  jpegQuality: number;
  maxRpm: number;
}

/**
 * 获取当前运行时的成本控制策略
 */
export function getRuntimeStrategy(
  env: Record<string, string | undefined> = process.env,
): RuntimeStrategy {
  return {
    maxImageSize: Number(env.COST_MAX_IMAGE_SIZE ?? 512),
    jpegQuality: Number(env.COST_JPEG_QUALITY ?? 0.7),
    maxRpm: Number(env.COST_MAX_RPM ?? 60),
  };
}

export function parseSharedEnv(
  env: Record<string, string | undefined> = process.env,
) {
  return sharedEnvSchema.parse(env);
}

export function parseBffEnv(
  env: Record<string, string | undefined> = process.env,
) {
  return bffEnvSchema.parse(env);
}

export function parseWebEnv(
  env: Record<string, string | undefined> = process.env,
) {
  return webEnvSchema.parse(env);
}
