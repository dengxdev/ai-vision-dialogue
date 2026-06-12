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
}

export interface FrameResult {
  frameId: string;
  description: string;
  tokensUsed: number;
}

export interface DialogueResult {
  reply: string;
}
