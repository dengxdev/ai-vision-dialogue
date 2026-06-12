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

interface FramePayload {
  frameId: string;
  imageBase64: string;
  timestamp: number;
}

interface DialoguePayload {
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

  constructor(
    private readonly costGuardian: CostGuardian,
    private readonly cacheService: CacheService,
  ) {}

  handleConnection(client: Socket): void {
    this.sessions.set(client.id, client);
    console.log(`[video] client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.sessions.delete(client.id);
    console.log(`[video] client disconnected: ${client.id}`);
  }

  @SubscribeMessage('frame')
  handleFrame(
    @MessageBody() payload: FramePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const { frameId, imageBase64 } = payload;
    const clientId = client.id;

    // 1. Scene classification.
    const scene = this.costGuardian.classifyScene(imageBase64);
    if (!this.costGuardian.shouldProceed(scene)) {
      const result: FrameResult = {
        frameId,
        description: 'scene filtered by cost guardian',
        tokensUsed: 0,
      };
      client.emit('frame:result', result);
      return;
    }

    // 2. Rate limiting.
    if (!this.costGuardian.checkRateLimit(clientId)) {
      const result: FrameResult = {
        frameId,
        description: 'rate limited (60 rpm)',
        tokensUsed: 0,
      };
      client.emit('frame:result', result);
      return;
    }

    // 3. Cache lookup.
    const hash = this.cacheService.getHash(imageBase64);
    const cached = this.cacheService.get<FrameResult>(hash);
    if (cached) {
      client.emit('frame:result', { ...cached, frameId });
      return;
    }

    // Record the request and return a mock result.
    this.costGuardian.recordRequest(clientId);
    const result: FrameResult = {
      frameId,
      description: 'mock description',
      tokensUsed: scene === SceneType.HighDetail ? 1200 : 600,
    };
    this.cacheService.set(hash, result);
    client.emit('frame:result', result);
  }

  @SubscribeMessage('dialogue')
  handleDialogue(
    @MessageBody() payload: DialoguePayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const { message } = payload;
    const reply = `这是 mock 回复（收到：${message}）`;
    client.emit('dialogue:result', { reply });
  }
}
