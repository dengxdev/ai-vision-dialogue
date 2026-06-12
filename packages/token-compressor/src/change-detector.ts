export interface ChangeDetectionOptions {
  threshold?: number;
}

export function hasSignificantChange(
  _prev: string,
  _next: string,
  _options?: ChangeDetectionOptions,
): boolean {
  // TODO: implement perceptual diff or phash comparison
  return true;
}
