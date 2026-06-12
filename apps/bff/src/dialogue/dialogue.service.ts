import { Injectable, Logger } from '@nestjs/common';
import type { DialogueMessage, DialogueResponse, MultimodalInput } from '@ai-vision/shared';
import { VisionService } from '../vision/vision.service';

interface VisionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

@Injectable()
export class DialogueService {
  private readonly logger = new Logger(DialogueService.name);
  private readonly histories = new Map<string, DialogueMessage[]>();
  private readonly maxHistoryRounds = 10;

  constructor(private readonly visionService: VisionService) {}

  async chat(input: MultimodalInput): Promise<DialogueResponse> {
    const { text, imageBase64, sessionId } = input;
    const history = this.getHistory(sessionId);

    let assistantContent = '';
    let costTokens = 0;

    if (imageBase64) {
      const visionResult = await this.visionService.analyze({
        imageBase64,
        prompt: text?.trim() || '描述画面内容',
        context: this.toVisionMessages(history),
      });
      assistantContent = visionResult.description;
      costTokens = visionResult.tokensUsed;
    } else {
      assistantContent = this.generateTextReply(text ?? '');
      costTokens = 0;
    }

    const userMessage: DialogueMessage = {
      role: 'user',
      content: text ?? '',
      timestamp: Date.now(),
      attachments: imageBase64
        ? [{ type: 'image', data: imageBase64 }]
        : undefined,
    };

    const assistantMessage: DialogueMessage = {
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
    };

    history.push(userMessage, assistantMessage);
    this.trimHistory(history);
    this.histories.set(sessionId, history);

    return {
      message: assistantMessage,
      costTokens,
    };
  }

  clearHistory(sessionId: string): void {
    this.histories.delete(sessionId);
  }

  private getHistory(sessionId: string): DialogueMessage[] {
    return this.histories.get(sessionId) ?? [];
  }

  private trimHistory(history: DialogueMessage[]): void {
    // 保留最近 maxHistoryRounds 轮（一轮 = user + assistant 两条消息）
    const maxMessages = this.maxHistoryRounds * 2;
    if (history.length > maxMessages) {
      history.splice(0, history.length - maxMessages);
    }
  }

  private toVisionMessages(history: DialogueMessage[]): VisionMessage[] {
    return history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private generateTextReply(userText: string): string {
    if (!userText.trim()) {
      return '我没有收到你的问题，可以再说一遍吗？';
    }
    return `收到你的问题：“${userText}”。我暂时处于文本回复模式。`;
  }
}
