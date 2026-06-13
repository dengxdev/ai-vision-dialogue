import type { CostMetrics } from '@ai-vision/shared';
import './CostPanel.css';

export interface CostPanelProps {
  visible: boolean;
  metrics: CostMetrics;
  online?: boolean;
}

export function CostPanel({ visible, metrics, online = true }: CostPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="cost-panel">
      <div className="cost-panel__header">
        <span className="cost-panel__title">成本监控面板</span>
        <span className={`cost-panel__subtitle ${!online ? 'cost-panel__subtitle--offline' : ''}`}>
          {online ? '实时' : '离线'}
        </span>
      </div>

      {!online && (
        <div className="cost-panel__offline">
          与 BFF 连接已断开，数据不再更新
        </div>
      )}

      <div className="cost-panel__grid">
        <div className="cost-panel__item">
          <span className="cost-panel__label">视觉 API 调用</span>
          <span className="cost-panel__value">{metrics.visionCalls}</span>
        </div>
        <div className="cost-panel__item">
          <span className="cost-panel__label">LLM 调用</span>
          <span className="cost-panel__value">{metrics.llmCalls}</span>
        </div>

        <div className="cost-panel__item">
          <span className="cost-panel__label">输入 Tokens</span>
          <span className="cost-panel__value">{metrics.inputTokens}</span>
        </div>
        <div className="cost-panel__item">
          <span className="cost-panel__label">输出 Tokens</span>
          <span className="cost-panel__value">{metrics.outputTokens}</span>
        </div>

        <div className="cost-panel__item cost-panel__item--wide">
          <span className="cost-panel__label">总 Tokens</span>
          <span className="cost-panel__value">{metrics.totalTokens}</span>
        </div>

        <div className="cost-panel__item cost-panel__item--wide">
          <span className="cost-panel__label">预估费用</span>
          <span className="cost-panel__value cost-panel__value--cost">
            ¥{metrics.estimatedCostCny.toFixed(4)}
          </span>
        </div>

        <div className="cost-panel__item">
          <span className="cost-panel__label">帧捕获 / 跳过</span>
          <span className="cost-panel__value">
            {metrics.framesCaptured} / {metrics.framesSkipped}
          </span>
        </div>
        <div className="cost-panel__item">
          <span className="cost-panel__label">缓存命中</span>
          <span className="cost-panel__value">{metrics.cacheHits}</span>
        </div>

        <div className="cost-panel__item cost-panel__item--wide">
          <span className="cost-panel__label">平均响应时间</span>
          <span className="cost-panel__value">{metrics.avgResponseMs} ms</span>
        </div>

        <div className="cost-panel__item cost-panel__item--wide">
          <span className="cost-panel__label">当前 RPM</span>
          <span className="cost-panel__value">{metrics.rpm}</span>
        </div>
      </div>

      <div className="cost-panel__footer">
        按 Ctrl+Shift+D 隐藏
      </div>
    </div>
  );
}
