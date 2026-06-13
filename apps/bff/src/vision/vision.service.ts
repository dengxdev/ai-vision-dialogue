import { Injectable, Logger } from '@nestjs/common';
import { createConfig } from '@ai-vision/config';

interface VisionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

export interface AnalyzeRequest {
  frameId?: string;
  imageBase64: string;
  prompt?: string;
  context?: VisionMessage[];
  maxTokens?: number;
}

export interface AnalyzeResult {
  frameId: string;
  description: string;
  confidence: number;
  tokensUsed: number;
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
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly config = createConfig(process.env);

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResult> {
    const frameId = request.frameId ?? this.generateFrameId();

    if (this.shouldMock()) {
      this.logger.warn(`[vision] mock mode enabled for frame ${frameId}`);
      return this.mockAnalyze(frameId);
    }

    const prompt = request.prompt?.trim() || '描述画面内容';
    const messages = this.buildMessages(request.imageBase64, prompt, request.context);

    let lastError: Error | undefined;
    const maxRetries = 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.callQwenApi(messages, request.maxTokens);
        return {
          frameId,
          description: result.description,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          `[vision] Qwen-VL call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`,
        );
      }
    }

    if (this.config.ENABLE_VISION_FALLBACK) {
      this.logger.warn(`[vision] falling back to mock for frame ${frameId}`);
      return this.mockAnalyze(frameId);
    }

    throw lastError ?? new Error('Vision analysis failed after retries');
  }

  private shouldMock(): boolean {
    return (
      this.config.ENABLE_MOCK_VISION ||
      !this.config.VISION_API_KEY
    );
  }

  private mockAnalyze(frameId: string): AnalyzeResult {
    return {
      frameId,
      description: '当前画面看起来比较清晰，但没有检测到显著物体（mock 模式）。',
      confidence: 0.75,
      tokensUsed: 0,
    };
  }

  private buildMessages(
    imageBase64: string,
    prompt: string,
    context?: VisionMessage[],
  ): VisionMessage[] {
    const systemMessage: VisionMessage = {
      role: 'system',
      content:
        '你是 AI 视觉对话助手，能准确描述摄像头画面中的物体、场景，并回答用户问题。请用中文回答，简洁自然。',
    };

    const userContent: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }> = [
      {
        type: 'image_url',
        image_url: {
          url: imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`,
        },
      },
      { type: 'text', text: prompt },
    ];

    const userMessage: VisionMessage = {
      role: 'user',
      content: userContent,
    };

    return [systemMessage, ...(context ?? []), userMessage];
  }

  private async callQwenApi(
    messages: VisionMessage[],
    maxTokens = 512,
  ): Promise<AnalyzeResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(this.config.VISION_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.VISION_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.config.VISION_MODEL,
          messages,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `[vision] Qwen API request URL=${this.config.VISION_API_URL} model=${this.config.VISION_MODEL} status=${response.status} body=${text.slice(0, 500)}`,
        );
        throw new Error(`Qwen API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as QwenCompletionResponse;

      if (data.error) {
        throw new Error(`Qwen API error: ${data.error.message}`);
      }

      const description = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!description) {
        throw new Error('Qwen API returned empty description');
      }

      const tokensUsed = data.usage?.total_tokens ?? 0;
      const confidence = this.estimateConfidence(description);

      return {
        frameId: '', // filled by caller
        description,
        confidence,
        tokensUsed,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private estimateConfidence(description: string): number {
    // 简单启发式：回答越长、包含具体名词越多，置信度越高。
    const words = description.split(/\s+/).length;
    const base = 0.75;
    const boost = Math.min(words / 100, 0.2);
    return Number((base + boost).toFixed(2));
  }

  private generateFrameId(): string {
    return `frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
