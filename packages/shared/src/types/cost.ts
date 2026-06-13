export interface CostMetrics {
  apiCalls: number;
  visionCalls: number;
  llmCalls: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCny: number;
  rpm: number;
  windowStart: number;
  framesCaptured: number;
  framesSkipped: number;
  cacheHits: number;
  avgResponseMs: number;
}

export enum SceneType {
  General = 'general',
  HighDetail = 'high_detail',
  LowValue = 'low_value',
  Blank = 'blank',
  Static = 'static',
  Transition = 'transition',
  Normal = 'normal',
}

export interface ResolutionTier {
  maxWidth: number;
  quality: number;
}

export interface FrameResult {
  frameId: string;
  description: string;
  tokensUsed: number;
  fromCache?: boolean;
}

export interface DialogueResult {
  reply: string;
  /** 本次对话消耗的总 token 数（视觉 + 文本），由 BFF 返回 */
  usage?: number;
  /** 视觉模型消耗的 token 数（仅在对话流程中调用了视觉模型时返回） */
  visionUsage?: number;
  /** 视觉模型输入 token 数 */
  visionPromptTokens?: number;
  /** 视觉模型输出 token 数 */
  visionCompletionTokens?: number;
  /** 文本 LLM 消耗的 token 数 */
  llmUsage?: number;
  /** 文本 LLM 输入 token 数 */
  llmPromptTokens?: number;
  /** 文本 LLM 输出 token 数 */
  llmCompletionTokens?: number;
}
