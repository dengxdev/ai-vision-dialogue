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
import { SceneType } from '@ai-vision/shared';
import {
  costMetricsPayloadSchema,
  dialoguePayloadSchema,
  dialogueResultSchema,
  framePayloadSchema,
  frameRateLimitedSchema,
  frameResultSchema,
  frameSkippedSchema,
  type CostMetricsPayload,
  type DialoguePayload,
  type FramePayload,
  type FrameRateLimited,
  type FrameSkipped,
} from '@ai-vision/contract';
import { CacheService } from '../cache/cache.service';
import { CostGuardian } from '../cost/cost.guardian';
import { CostService } from '../cost/cost.service';
import { DialogueService } from '../dialogue/dialogue.service';
import { VisionService, type AnalyzeResult } from '../vision/vision.service';

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
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const validation = framePayloadSchema.safeParse(rawPayload);
    if (!validation.success) {
      const frameId =
        typeof rawPayload === 'object' &&
        rawPayload !== null &&
        'frameId' in rawPayload &&
        typeof (rawPayload as { frameId: unknown }).frameId === 'string'
          ? (rawPayload as { frameId: string }).frameId
          : 'unknown';
      console.warn(`[video] invalid frame payload: ${validation.error.message}`);
      client.emit('frame:error', {
        frameId,
        error: '帧数据格式不正确，请检查发送内容',
      });
      return;
    }

    const payload: FramePayload = validation.data;
    const { frameId, imageBase64 } = payload;
    const clientId = client.id;

    try {
      // 1. 场景分类（基于 base64 大小判断 BLANK / NORMAL）
      const scene = this.costGuardian.classifyScene(imageBase64);
      if (!this.costGuardian.shouldProceed(scene)) {
        console.log(`[video] skip frame ${frameId}: scene=${scene}`);
        this.costService.recordFrame(clientId, { skipped: true });
        const skipped: FrameSkipped = {
          frameId,
          reason: 'scene filtered by cost guardian',
        };
        client.emit('frame:skipped', skipped);
        return;
      }

      // 2. 帧间变化检测：感知哈希缓存命中则视为 STATIC，跳过 API 调用
      const hash = await this.cacheService.getHash(imageBase64);
      if (this.lastFrameHashes.get(clientId) === hash) {
        console.log(`[video] skip frame ${frameId}: static frame (hash unchanged)`);
        this.costService.recordFrame(clientId, { skipped: true });
        const skipped: FrameSkipped = {
          frameId,
          reason: 'static frame filtered by perceptual hash cache',
        };
        client.emit('frame:skipped', skipped);
        return;
      }

      // 3. 动态分辨率降级（下发给前端或供内部使用）
      const tier = this.costGuardian.selectResolutionTier();
      client.emit('frame:tier', tier);

      // 4. 频次限流（令牌桶，60 RPM），通过后立即扣减 token，避免 await 期间出现竞态
      if (!this.costGuardian.checkRateLimit(clientId)) {
        console.log(`[video] skip frame ${frameId}: rate limited`);
        this.costService.recordFrame(clientId, { skipped: true });
        const rateLimited: FrameRateLimited = { frameId };
        client.emit('frame:rate-limited', rateLimited);
        return;
      }
      this.costGuardian.recordRequest(clientId);

      // 5. 缓存查找
      const cached = this.cacheService.get<AnalyzeResult>(hash);
      if (cached) {
        console.log(`[video] cache hit frame ${frameId}`);
        this.lastFrameHashes.set(clientId, hash);
        this.costService.recordFrame(clientId, { cacheHit: true });
        const result = frameResultSchema.parse({
          frameId,
          description: cached.description,
          tokensUsed:
            cached.promptTokens !== undefined ||
            cached.completionTokens !== undefined
              ? {
                  input: cached.promptTokens ?? 0,
                  output: cached.completionTokens ?? 0,
                }
              : undefined,
          fromCache: true,
        });
        client.emit('frame:result', result);
        return;
      }

      // 6. 真实 VisionService 调用（无 API Key 时自动降级为 mock）
      this.costService.recordFrame(clientId, {});
      const startAt = Date.now();
      const analyzeResult = await this.visionService.analyze({
        frameId,
        imageBase64,
        prompt: '描述画面内容',
      });

      this.cacheService.set(hash, analyzeResult);
      this.lastFrameHashes.set(clientId, hash);

      const result = frameResultSchema.parse({
        frameId: analyzeResult.frameId,
        description: analyzeResult.description,
        tokensUsed:
          analyzeResult.promptTokens !== undefined ||
          analyzeResult.completionTokens !== undefined
            ? {
                input: analyzeResult.promptTokens ?? 0,
                output: analyzeResult.completionTokens ?? 0,
              }
            : undefined,
      });
      client.emit('frame:result', result);

      this.costService.recordVisionCall(clientId, {
        tokensUsed: analyzeResult.tokensUsed,
        promptTokens: analyzeResult.promptTokens,
        completionTokens: analyzeResult.completionTokens,
        durationMs: Date.now() - startAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[video] frame processing failed: ${message}`);
      client.emit('frame:error', {
        frameId,
        error: '帧处理失败，请检查画面数据或稍后重试',
      });
    }
  }

  @SubscribeMessage('dialogue')
  async handleDialogue(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const validation = dialoguePayloadSchema.safeParse(rawPayload);
    if (!validation.success) {
      console.warn(
        `[video] invalid dialogue payload from ${client.id}: ${validation.error.message}`,
      );
      client.emit('dialogue:error', {
        message: '对话消息格式不正确，请检查发送内容',
      });
      return;
    }

    const payload: DialoguePayload = validation.data;
    console.log(
      `[video] dialogue received from ${client.id}: message="${payload.message?.slice(0, 30) ?? ''}" hasFrame=${Boolean(payload.frame)}`,
    );

    const clientId = client.id;
    const startAt = Date.now();

    // 对话流程中如果携带画面，也计为一次帧捕获
    const hasFrame = Boolean(payload.frame?.imageBase64);
    if (hasFrame) {
      this.costService.recordFrame(clientId, {});
    }

    try {
      const response = await this.dialogueService.chat({
        sessionId: clientId,
        message: payload.message,
        visualContext: payload.frame?.imageBase64,
        history: payload.history?.map((item) => ({
          ...item,
          timestamp: Date.now(),
        })),
      });

      const durationMs = Date.now() - startAt;

      console.log(`[video] dialogue response for ${client.id}: reply="${response.reply?.slice(0, 50) ?? ''}"`);
      const result = dialogueResultSchema.parse({
        reply: response.reply,
        usage:
          response.llmPromptTokens !== undefined ||
          response.llmCompletionTokens !== undefined
            ? {
                input: response.llmPromptTokens ?? 0,
                output: response.llmCompletionTokens ?? 0,
              }
            : undefined,
      });
      client.emit('dialogue:result', result);

      if (hasFrame && response.visionFromCache) {
        this.costService.recordFrame(clientId, { cacheHit: true });
      }

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
          durationMs,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[video] dialogue failed: ${message}`);
      client.emit('dialogue:error', {
        message: '对话处理失败，请稍后重试',
      });
    }
  }

  @SubscribeMessage('metrics')
  handleMetrics(@ConnectedSocket() client: Socket): void {
    const metrics = this.costService.getMetrics(client.id);
    const payload: CostMetricsPayload = costMetricsPayloadSchema.parse({
      apiCalls: metrics.apiCalls,
      visionCalls: metrics.visionCalls,
      llmCalls: metrics.llmCalls,
      totalTokens: metrics.totalTokens,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      estimatedCostCny: metrics.estimatedCostCny,
      rpm: metrics.rpm,
      windowStart: metrics.windowStart,
      framesCaptured: metrics.framesCaptured,
      framesSkipped: metrics.framesSkipped,
      cacheHits: metrics.cacheHits,
      avgResponseMs: metrics.avgResponseMs,
    });
    client.emit('metrics:result', payload);
  }
}
