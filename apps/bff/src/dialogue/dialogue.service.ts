import { Injectable, Logger } from '@nestjs/common';
import { createConfig } from '@ai-vision/config';
import type { DialogueMessage, DialogueResponse, MultimodalInput } from '@ai-vision/shared';
import { VisionService } from '../vision/vision.service';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QwenCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message: string;
  };
}

@Injectable()
export class DialogueService {
  private readonly logger = new Logger(DialogueService.name);
  private readonly config = createConfig(process.env);
  private readonly histories = new Map<string, DialogueMessage[]>();

  /** 保留最近 N 轮对话 */
  private readonly maxHistoryRounds = 10;
  /** 超过该轮数后对早期对话进行摘要 */
  private readonly summaryThresholdRounds = 6;
  /** 单条消息最大 token 预算（粗略估算） */
  private readonly maxContextTokens = 4096;

  constructor(private readonly visionService: VisionService) {}

  async chat(input: MultimodalInput): Promise<DialogueResponse> {
    const { sessionId, message, visualContext } = input;
    const history = input.history ?? this.getHistory(sessionId);

    let visualDescription = '';
    let visionTokens = 0;

    // 1. 解析视觉上下文：如果是图片则先调用视觉模型获取画面描述
    if (visualContext) {
      if (this.looksLikeImageBase64(visualContext)) {
        const visionResult = await this.visionService.analyze({
          imageBase64: visualContext,
          prompt: message?.trim() || '描述画面内容',
          context: this.toVisionMessages(history),
        });
        visualDescription = visionResult.description;
        visionTokens = visionResult.tokensUsed;
      } else {
        visualDescription = visualContext;
      }
    }

    // 2. 构建融合消息：[画面描述] + [用户问题]
    const userContent = this.buildUserContent(message, visualDescription);

    // 3. 对话上下文管理：滑动窗口 + 摘要 + Token 截断
    const managedHistory = this.manageHistory(history);

    // 4. 调用 Qwen-Turbo（OpenAI 兼容格式）
    const messages = this.buildLLMMessages(managedHistory, userContent);

    let reply: string;
    let llmUsage = 0;

    if (this.shouldMockLLM()) {
      this.logger.warn(`[dialogue] mock mode enabled for session ${sessionId}`);
      reply = this.mockReply(message ?? '', visualDescription);
      llmUsage = this.estimateTokens(reply);
    } else {
      const result = await this.callQwenTurbo(messages);
      reply = result.reply;
      llmUsage = result.usage;
    }

    // 5. 更新并保存会话历史
    this.updateHistory(sessionId, managedHistory, message ?? '', reply, visualContext);

    return {
      reply,
      usage: llmUsage + visionTokens,
    };
  }

  clearHistory(sessionId: string): void {
    this.histories.delete(sessionId);
  }

  private getHistory(sessionId: string): DialogueMessage[] {
    return this.histories.get(sessionId) ?? [];
  }

  private updateHistory(
    sessionId: string,
    history: DialogueMessage[],
    message: string,
    reply: string,
    visualContext?: string,
  ): void {
    const userMessage: DialogueMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
      attachments: visualContext ? [{ type: 'image', data: visualContext }] : undefined,
    };

    const assistantMessage: DialogueMessage = {
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
    };

    history.push(userMessage, assistantMessage);
    this.histories.set(sessionId, history);
  }

  /**
   * 对话上下文管理：
   * - 保留最近 maxHistoryRounds 轮对话
   * - 超过 summaryThresholdRounds 时自动摘要早期对话
   * - Token 超限时从最早非系统消息截断
   */
  private manageHistory(history: DialogueMessage[]): DialogueMessage[] {
    const rounds = history.length / 2;

    if (rounds > this.summaryThresholdRounds) {
      const roundsToSummarize = Math.min(
        Math.floor(rounds - this.summaryThresholdRounds),
        this.maxHistoryRounds - this.summaryThresholdRounds,
      );
      const messagesToSummarize = history.splice(0, roundsToSummarize * 2);
      const summary = this.summarizeMessages(messagesToSummarize);
      history.unshift({
        role: 'system',
        content: `历史对话摘要：${summary}`,
        timestamp: Date.now(),
      });
    }

    const maxMessages = this.maxHistoryRounds * 2;
    if (history.length > maxMessages) {
      history.splice(0, history.length - maxMessages);
    }

    this.truncateByTokens(history);
    return history;
  }

  private summarizeMessages(messages: DialogueMessage[]): string {
    const text = messages
      .map((msg) => `${msg.role === 'user' ? '用户' : '助手'}：${msg.content}`)
      .join('；');
    if (text.length > 200) {
      return `${text.slice(0, 200)}...`;
    }
    return text;
  }

  private truncateByTokens(history: DialogueMessage[]): void {
    let tokens = history.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);

    while (tokens > this.maxContextTokens && history.length > 2) {
      const removed = history.shift();
      if (removed) {
        tokens -= this.estimateTokens(removed.content);
      }
    }
  }

  /**
   * 粗略 token 估算：中文字符按 1 token，英文单词按 1.3 token
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    const englishWords = text
      .split(/\s+/)
      .filter((word) => /[a-zA-Z]/.test(word)).length;
    return Math.ceil(chineseChars + englishWords * 1.3);
  }

  private buildUserContent(message: string, visualDescription: string): string {
    const hasMessage = message.trim().length > 0;
    if (visualDescription && hasMessage) {
      return `[画面描述] ${visualDescription}\n[用户问题] ${message}`;
    }
    if (visualDescription) {
      return `[画面描述] ${visualDescription}\n[用户问题] 请描述画面`;
    }
    return message;
  }

  private buildLLMMessages(history: DialogueMessage[], userContent: string): LLMMessage[] {
    const systemMessage: LLMMessage = {
      role: 'system',
      content:
        '你是一个多模态 AI 助手，能结合摄像头画面理解用户问题。请用中文回答，控制在3句话内，简洁自然。',
    };

    const historyMessages: LLMMessage[] = history.map((msg) => ({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content,
    }));

    return [systemMessage, ...historyMessages, { role: 'user', content: userContent }];
  }

  private async callQwenTurbo(messages: LLMMessage[]): Promise<{ reply: string; usage: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(this.config.LLM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.config.LLM_MODEL,
          messages,
          max_tokens: 256,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `[dialogue] Qwen API request URL=${this.config.LLM_API_URL} model=${this.config.LLM_MODEL} status=${response.status} body=${text.slice(0, 500)}`,
        );
        throw new Error(`Qwen API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as QwenCompletionResponse;

      if (data.error) {
        throw new Error(`Qwen API error: ${data.error.message}`);
      }

      const reply = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!reply) {
        throw new Error('Qwen API returned empty reply');
      }

      return {
        reply,
        usage: data.usage?.total_tokens ?? this.estimateTokens(reply),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private shouldMockLLM(): boolean {
    return this.config.ENABLE_MOCK_LLM || !this.config.LLM_API_KEY;
  }

  private mockReply(message: string, visualDescription: string): string {
    const shortVisual =
      visualDescription.length > 30
        ? `${visualDescription.slice(0, 30)}...`
        : visualDescription;

    if (visualDescription) {
      return `（mock）我看到画面是“${shortVisual}”，你问的是“${message || '请描述画面'}”。这是本地模拟回复。`;
    }
    return `（mock）收到你的问题：“${message || '（空）'}”。当前未接入真实 LLM，这是本地模拟回复。`;
  }

  private looksLikeImageBase64(value: string): boolean {
    return value.startsWith('data:image') || value.length > 1000;
  }

  private toVisionMessages(
    history: DialogueMessage[],
  ): Parameters<VisionService['analyze']>[0]['context'] {
    return history
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })) as Parameters<VisionService['analyze']>[0]['context'];
  }
}
