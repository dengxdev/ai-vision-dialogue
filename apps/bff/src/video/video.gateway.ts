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
  namespace: 'video',
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
      const result: FrameResult = {
        frameId,
        description: 'scene filtered by cost guardian',
        tokensUsed: 0,
      };
      client.emit('frame:result', result);
      return;
    }

    // 2. 帧间变化检测：感知哈希缓存命中则视为 STATIC，跳过 API 调用
    const hash = this.cacheService.getHash(imageBase64);
    if (this.lastFrameHashes.get(clientId) === hash) {
      console.log(`[video] skip frame ${frameId}: static frame (hash unchanged)`);
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
      client.emit('frame:result', {
        frameId,
        description: cached.description,
        tokensUsed: cached.tokensUsed,
        fromCache: true,
      });
      return;
    }

    // 6. 真实 VisionService 调用（无 API Key 时自动降级为 mock）
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
    try {
      const response = await this.dialogueService.chat({
        sessionId: payload.sessionId,
        text: payload.message,
        imageBase64: payload.frame,
      });

      client.emit('dialogue:result', {
        reply: response.message.content,
        costTokens: response.costTokens,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[video] dialogue failed: ${message}`);
      client.emit('dialogue:error', {
        error: '对话处理失败，请稍后重试',
      });
    }
  }
}
