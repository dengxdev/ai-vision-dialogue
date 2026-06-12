export interface DialogueMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Array<{ type: 'image'; data: string }>;
}

export interface MultimodalInput {
  text?: string;
  imageBase64?: string;
  sessionId: string;
}

export interface DialogueResponse {
  message: DialogueMessage;
  costTokens: number;
}
