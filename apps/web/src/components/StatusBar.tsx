import './StatusBar.css';

interface StatusBarProps {
  statusText: string;
  online?: boolean;
}

export function StatusBar({ statusText, online = false }: StatusBarProps) {
  return (
    <header className="status-bar">
      <div className="status-bar__brand">
        <div className="status-bar__logo" aria-hidden="true" />
        <div className="status-bar__titles">
          <h1>AI Vision Dialogue</h1>
          <p>AI 视觉对话助手</p>
        </div>
      </div>

      <div className="status-bar__status">
        <span className="status-bar__status-text">{statusText}</span>
      </div>

      <div className="status-bar__connection">
        <span className={`status-bar__dot ${online ? 'status-bar__dot--online' : 'status-bar__dot--offline'}`} />
        <span className="status-bar__connection-text">{online ? '已连接' : '未连接'}</span>
      </div>
    </header>
  );
}
