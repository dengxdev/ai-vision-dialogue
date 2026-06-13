import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { FrameResult, SceneType } from '@ai-vision/shared';
import { CacheService } from '../cache/cache.service';
import { CostGuardian } from '../cost/cost.guardian';
import { CostService } from '../cost/cost.service';
import { DialogueService } from '../dialogue/dialogue.service';
import { VisionService, type AnalyzeResult } from '../vision/vision.service';

interface FramePayload {
  frameId: string;
  imageBase64: string;
  timestamp: number;
}

interface DialoguePayload {
  sessionId: string;
  message: string;
  frame?: string;
}

@WebSocketGateway({
  namespace: process.env.WS_NAMESPACE || 'video',
  cors: { origin: '*' },
})
export class VideoGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly sessions = new Map<string, Socket>();
  private readonly lastFrameHashes = new Map<string, string>();

  constructor(
    private readonly costGuardian: CostGuardian,
    private readonly costService: CostService,
    private readonly cacheService: CacheService,
    private readonly visionService: VisionService,
    private readonly dialogueService: DialogueService,
  ) {}

  handleConnection(client: Socket): void {
    this.sessions.set(client.id, client);
    console.log(`[video] client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.sessions.delete(client.id);
    this.lastFrameHashes.delete(client.id);
    this.dialogueService.clearHistory(client.id);
    this.costService.clearClient(client.id);
    console.log(`[video] client disconnected: ${client.id}`);
  }

  @SubscribeMessage('frame')
  async handleFrame(
    @MessageBody() payload: FramePayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { frameId, imageBase64 } = payload;
    const clientId = client.id;

    // 1. 场景分类（基于 base64 大小判断 BLANK / NORMAL）
    const scene = this.costGuardian.classifyScene(imageBase64);
    if (!this.costGuardian.shouldProceed(scene)) {
      console.log(`[video] skip frame ${frameId}: scene=${scene}`);
      this.costService.recordFrame(clientId, { skipped: true });
      const result: FrameResult = {
        frameId,
        description: 'scene filtered by cost guardian',
        tokensUsed: 0,
      };
      client.emit('frame:result', result);
      return;
    }

    // 2. 帧间变化检测：感知哈希缓存命中则视为 STATIC，跳过 API 调用
    const hash = await this.cacheService.getHash(imageBase64);
    if (this.lastFrameHashes.get(clientId) === hash) {
      console.log(`[video] skip frame ${frameId}: static frame (hash unchanged)`);
      this.costService.recordFrame(clientId, { skipped: true });
      const result: FrameResult = {
        frameId,
        description: 'static frame filtered by perceptual hash cache',
        tokensUsed: 0,
        fromCache: true,
      };
      client.emit('frame:result', result);
      return;
    }

    // 3. 动态分辨率降级（下发给前端或供内部使用）
    const tier = this.costGuardian.selectResolutionTier();
    client.emit('frame:tier', tier);

    // 4. 频次限流（令牌桶，60 RPM），通过后立即扣减 token，避免 await 期间出现竞态
    if (!this.costGuardian.checkRateLimit(clientId)) {
      console.log(`[video] skip frame ${frameId}: rate limited`);
      this.costService.recordFrame(clientId, { skipped: true });
      const result: FrameResult = {
        frameId,
        description: 'rate limited (60 rpm)',
        tokensUsed: 0,
      };
      client.emit('frame:result', result);
      return;
    }
    this.costGuardian.recordRequest(clientId);

    // 5. 缓存查找
    const cached = this.cacheService.get<AnalyzeResult>(hash);
    if (cached) {
      console.log(`[video] cache hit frame ${frameId}`);
      this.lastFrameHashes.set(clientId, hash);
      this.costService.recordFrame(clientId, { cacheHit: true });
      client.emit('frame:result', {
        frameId,
        description: cached.description,
        tokensUsed: cached.tokensUsed,
        fromCache: true,
      });
      return;
    }

    // 6. 真实 VisionService 调用（无 API Key 时自动降级为 mock）
    this.costService.recordFrame(clientId, {});
    const startAt = Date.now();
    try {
      const analyzeResult = await this.visionService.analyze({
        frameId,
        imageBase64,
        prompt: '描述画面内容',
      });

      this.cacheService.set(hash, analyzeResult);
      this.lastFrameHashes.set(clientId, hash);

      const result: FrameResult = {
        frameId: analyzeResult.frameId,
        description: analyzeResult.description,
        tokensUsed: analyzeResult.tokensUsed,
      };
      client.emit('frame:result', result);

      this.costService.recordVisionCall(clientId, {
        tokensUsed: analyzeResult.tokensUsed,
        promptTokens: analyzeResult.promptTokens,
        completionTokens: analyzeResult.completionTokens,
        durationMs: Date.now() - startAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[video] vision analysis failed: ${message}`);
      client.emit('frame:error', {
        frameId,
        error: '视觉分析失败，请检查网络或稍后重试',
      });
    }
  }

  @SubscribeMessage('dialogue')
  async handleDialogue(
    @MessageBody() payload: DialoguePayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    console.log(
      `[video] dialogue received from ${client.id}: message="${payload.message?.slice(0, 30) ?? ''}" hasFrame=${Boolean(payload.frame)}`,
    );

    const clientId = client.id;
    const startAt = Date.now();

    try {
      const response = await this.dialogueService.chat({
        sessionId: payload.sessionId,
        message: payload.message,
        visualContext: payload.frame,
      });

      const durationMs = Date.now() - startAt;

      console.log(`[video] dialogue response for ${client.id}: reply="${response.reply?.slice(0, 50) ?? ''}"`);
      client.emit('dialogue:result', {
        reply: response.reply,
        usage: response.usage,
        visionUsage: response.visionUsage,
        visionPromptTokens: response.visionPromptTokens,
        visionCompletionTokens: response.visionCompletionTokens,
        llmUsage: response.llmUsage,
        llmPromptTokens: response.llmPromptTokens,
        llmCompletionTokens: response.llmCompletionTokens,
      });

      if (response.visionUsage && response.visionUsage > 0) {
        this.costService.recordVisionCall(clientId, {
          tokensUsed: response.visionUsage,
          promptTokens: response.visionPromptTokens,
          completionTokens: response.visionCompletionTokens,
          durationMs,
        });
      }

      if (response.llmUsage && response.llmUsage > 0) {
        this.costService.recordLLMCall(clientId, {
          tokensUsed: response.llmUsage,
          promptTokens: response.llmPromptTokens,
          completionTokens: response.llmCompletionTokens,
          durationMs: 0,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[video] dialogue failed: ${message}`);
      client.emit('dialogue:error', {
        error: '对话处理失败，请稍后重试',
      });
    }
  }

  @SubscribeMessage('metrics')
  handleMetrics(@ConnectedSocket() client: Socket): void {
    const metrics = this.costService.getMetrics(client.id);
    client.emit('metrics:result', metrics);
  }
}
