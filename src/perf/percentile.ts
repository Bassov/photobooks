/** Inclusive nearest-rank p95 for a non-empty sorted copy of `values`. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    throw new Error('percentile requires at least one value')
  }
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  const index = Math.min(sorted.length - 1, Math.max(0, rank))
  const value = sorted[index]
  if (value === undefined) {
    throw new Error('percentile index out of range')
  }
  return value
}
