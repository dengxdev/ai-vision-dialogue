import * as ConfigModule from '@ai-vision/config';
import type { WebConfig, RuntimeStrategy } from '@ai-vision/config';

/**
 * Vite 默认只暴露以 VITE_ 开头的环境变量到 import.meta.env。
 * 为与 packages/config schema 保持无 VITE_ 前缀的命名一致，
 * 解析前去掉 VITE_ 前缀。
 */
function stripVitePrefix(env: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    const normalizedKey = key.startsWith('VITE_') ? key.slice(5) : key;
    stripped[normalizedKey] = value;
  }
  return stripped;
}

/**
 * 前端运行时配置，从 Vite 注入的 import.meta.env 解析
 *
 * 说明：@ai-vision/config 以 CommonJS 构建供 BFF 复用，无法直接引用 import.meta.env，
 * 因此由 web 应用层调用 createWebConfig(import.meta.env) 生成 config。
 */
const { createWebConfig, getRuntimeStrategy } = ConfigModule;

export const config: WebConfig = createWebConfig(stripVitePrefix(import.meta.env));

export const runtimeStrategy: RuntimeStrategy = getRuntimeStrategy(config);
