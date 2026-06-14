export interface DialogueMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Array<{ type: 'image'; data: string }>;
}

export interface MultimodalInput {
  sessionId: string;
  message: string;
  /** 画面描述文本或 base64 图片；传入图片时会先由视觉模型提取描述 */
  visualContext?: string;
  /** 可选外部历史；未传入时由服务按 sessionId 管理内存历史 */
  history?: DialogueMessage[];
}

export interface DialogueResponse {
  reply: string;
  usage: number;
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
  /** 视觉描述是否来自缓存命中 */
  visionFromCache?: boolean;
}
