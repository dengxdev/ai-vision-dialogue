export interface CostMetrics {
  apiCalls: number;
  totalTokens: number;
  estimatedCostCny: number;
  rpm: number;
  windowStart: number;
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
}
