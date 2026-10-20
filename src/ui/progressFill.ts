/** CSS transform for a determinate progress fill (0–100%). */
export function progressFillTransform(percentage: number | undefined): string {
  const pct = percentage ?? 0
  return `translateX(-${String(100 - pct)}%)`
}
