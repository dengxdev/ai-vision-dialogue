export interface SceneClassification {
  scene: string;
  confidence: number;
}

/**
 * 场景分类器
 * 根据图像内容识别场景类型，用于后续压缩/发送策略
 */
export class SceneClassifier {
  async classify(_imageData: ImageData): Promise<SceneClassification> {
    throw new Error('Not implemented');
  }
}
