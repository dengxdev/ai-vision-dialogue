import { useEffect, useRef } from 'react';
import './ChatPanel.css';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  hasVisualContext?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function ChatPanel({ messages }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="chat-panel" ref={containerRef}>
      <div className="chat-panel__header">
        <span className="chat-panel__title">对话记录</span>
        <span className="chat-panel__count">{messages.length} 条消息</span>
      </div>

      <div className="chat-panel__list">
        {messages.length === 0 && (
          <div className="chat-panel__empty">
            <p>按住麦克风或按空格键开始对话</p>
            <p className="chat-panel__empty-hint">对准摄像头展示物体并语音提问</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-panel__message chat-panel__message--${message.role}`}
          >
            <div className="chat-panel__bubble">
              <p className="chat-panel__text">{message.content}</p>
              {message.role === 'assistant' && message.hasVisualContext && (
                <span className="chat-panel__visual-tag">[视觉]</span>
              )}
            </div>
            <span className="chat-panel__time">{formatTime(message.timestamp)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
