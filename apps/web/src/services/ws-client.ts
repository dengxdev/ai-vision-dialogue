import { io, Socket } from 'socket.io-client';
import type { FrameResult, DialogueResult } from '@ai-vision/shared';

export interface FramePayload {
  frameId: string;
  imageBase64: string;
  timestamp: number;
}

export interface DialoguePayload {
  message: string;
  frame?: string;
}

export type WSClientEvent =
  | 'connected'
  | 'disconnected'
  | 'frame:result'
  | 'dialogue:result'
  | 'error';

export type WSClientListenerMap = {
  connected: () => void;
  disconnected: (reason: string) => void;
  'frame:result': (result: FrameResult) => void;
  'dialogue:result': (result: DialogueResult) => void;
  error: (error: Error) => void;
};

export class WSClient {
  private socket: Socket | null = null;
  private readonly listeners: {
    [K in WSClientEvent]?: Set<WSClientListenerMap[K]>;
  } = {};

  constructor(
    private readonly baseUrl: string,
    private readonly namespace = 'video',
  ) {}

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
      this.emit('error', error);
    });

    this.socket.on('frame:result', (result: FrameResult) => {
      this.emit('frame:result', result);
    });

    this.socket.on('dialogue:result', (result: DialogueResult) => {
      this.emit('dialogue:result', result);
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
