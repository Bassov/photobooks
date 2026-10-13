const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
const THRESHOLD = 1024

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError('bytes must be a non-negative finite number')
  }

  if (bytes < THRESHOLD) {
    return `${Math.round(bytes).toString()} B`
  }

  let value = bytes
  let unitIndex = 0
  while (value >= THRESHOLD && unitIndex < UNITS.length - 1) {
    value /= THRESHOLD
    unitIndex += 1
  }

  const rounded = Math.round(value * 10) / 10
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${label} ${UNITS[unitIndex]}`
}
