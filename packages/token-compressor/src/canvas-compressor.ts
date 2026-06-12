export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  mimeType?: string;
}

export function compressImageBase64(
  src: string,
  options: CompressionOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const ratio = Math.min(
        options.maxWidth / width,
        options.maxHeight / height,
        1,
      );
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(
        canvas.toDataURL(options.mimeType ?? 'image/jpeg', options.quality),
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
