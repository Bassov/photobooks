function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x === 0 ? 1 : x
}

export function aspectRatio(width: number, height: number): string {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('width and height must be positive finite numbers')
  }

  const w = Math.round(width)
  const h = Math.round(height)
  const d = gcd(w, h)
  return `${String(w / d)}:${String(h / d)}`
}
