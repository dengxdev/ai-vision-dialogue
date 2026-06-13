import { io, Socket } from 'socket.io-client';
import type { CompressionParams } from '@ai-vision/token-compressor';
import type {
  CostMetricsPayload,
  DialogueError,
  DialoguePayload,
  DialogueResult,
  FrameError,
  FramePayload,
  FrameRateLimited,
  FrameResult,
  FrameSkipped,
} from '@ai-vision/contract';

export type WSClientEvent =
  | 'connected'
  | 'disconnected'
  | 'frame:result'
  | 'frame:skipped'
  | 'frame:rate-limited'
  | 'frame:error'
  | 'frame:tier'
  | 'dialogue:result'
  | 'dialogue:error'
  | 'metrics:result'
  | 'error';

export type WSClientListenerMap = {
  connected: () => void;
  disconnected: (reason: string) => void;
  'frame:result': (result: FrameResult) => void;
  'frame:skipped': (detail: FrameSkipped) => void;
  'frame:rate-limited': (detail: FrameRateLimited) => void;
  'frame:error': (detail: FrameError) => void;
  'frame:tier': (tier: CompressionParams) => void;
  'dialogue:result': (result: DialogueResult) => void;
  'dialogue:error': (error: DialogueError) => void;
  'metrics:result': (metrics: CostMetricsPayload) => void;
  error: (error: Error) => void;
};

export class WSClient {
  private socket: Socket | null = null;
  private readonly listeners: {
    [K in WSClientEvent]?: Set<WSClientListenerMap[K]>;
  } = {};
  private readonly namespace: string;

  constructor(
    private readonly baseUrl: string,
    namespace = 'video',
  ) {
    this.namespace = namespace || 'video';
  }

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const url = this.namespace
      ? `${this.baseUrl}/${this.namespace}`
      : this.baseUrl;

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    });

    this.socket.on('connect', () => {
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      // eslint-disable-next-line no-console
      console.error('[WSClient] connect_error', error.message);
      this.emit('error', error);
    });

    this.socket.on('frame:result', (result: FrameResult) => {
      this.emit('frame:result', result);
    });

    this.socket.on('frame:skipped', (detail: FrameSkipped) => {
      this.emit('frame:skipped', detail);
    });

    this.socket.on('frame:rate-limited', (detail: FrameRateLimited) => {
      this.emit('frame:rate-limited', detail);
    });

    this.socket.on('frame:error', (detail: FrameError) => {
      this.emit('frame:error', detail);
    });

    this.socket.on('frame:tier', (tier: CompressionParams) => {
      this.emit('frame:tier', tier);
    });

    this.socket.on('dialogue:result', (result: DialogueResult) => {
      this.emit('dialogue:result', result);
    });

    this.socket.on('dialogue:error', (error: DialogueError) => {
      this.emit('dialogue:error', error);
    });

    this.socket.on('metrics:result', (metrics: CostMetricsPayload) => {
      this.emit('metrics:result', metrics);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  sendFrame(payload: FramePayload): void {
    this.socket?.emit('frame', payload);
  }

  sendDialogue(payload: DialoguePayload): void {
    this.socket?.emit('dialogue', payload);
  }

  requestMetrics(): void {
    this.socket?.emit('metrics');
  }

  on<K extends WSClientEvent>(
    event: K,
    listener: WSClientListenerMap[K],
  ): () => void {
    let set = this.listeners[event] as Set<WSClientListenerMap[K]> | undefined;
    if (!set) {
      set = new Set();
      this.listeners[event] = set as unknown as typeof this.listeners[K];
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends WSClientEvent>(
    event: K,
    listener: WSClientListenerMap[K],
  ): void {
    const set = this.listeners[event] as Set<WSClientListenerMap[K]> | undefined;
    set?.delete(listener);
  }

  private emit<K extends WSClientEvent>(
    event: K,
    ...args: Parameters<WSClientListenerMap[K]>
  ): void {
    const set = this.listeners[event] as Set<
      (arg: Parameters<WSClientListenerMap[K]>[0]) => void
    > | undefined;
    set?.forEach((listener) => {
      // TypeScript cannot narrow spread tuples here, so cast through unknown.
      (listener as (...p: unknown[]) => void)(...args);
    });
  }
}
