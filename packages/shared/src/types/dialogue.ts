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
}
