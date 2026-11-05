import type { Locator } from '@playwright/test'

/** CSS px from the locator's top-left corner. */
export interface Point {
  x: number
  y: number
}

/**
 * Hit stack at `at` (default: the centre), topmost first: per hit, the
 * data-testids of it and its ancestors, closest first. pointer-events:none
 * layers (grid SVG, overlays) are hit-tested too.
 */
export const topAt = (locator: Locator, at?: Point): Promise<string[][]> =>
  locator.evaluate((el, point: Point | null) => {
    const r = el.getBoundingClientRect()
    const p = point ?? { x: r.width / 2, y: r.height / 2 }
    const css = document.head.appendChild(document.createElement('style'))
    css.textContent = '* { pointer-events: auto !important }'
    const hits = document.elementsFromPoint(r.x + p.x, r.y + p.y)
    css.remove()
    const ids = [...document.querySelectorAll('[data-testid]')].reverse()
    const of = (hit: Element) => ids.filter((n) => n.contains(hit))
    return hits.map((h) =>
      of(h).map((n) => n.getAttribute('data-testid') ?? ''),
    )
  }, at ?? null)

/**
 * Paint in the locator box, from one clipped screenshot decoded in the page:
 * RGBA at `points`, or the share of box pixels outside `inner` (grown by 3 px
 * of shadow blur) unlike the background 1 px outside the box.
 */
export async function pixelsAt(
  box: Locator,
  points: Point[],
): Promise<number[][]>
export async function pixelsAt(box: Locator, inner: Locator): Promise<number>
export async function pixelsAt(box: Locator, probe: Point[] | Locator) {
  await box.scrollIntoViewIfNeeded()
  const b = await box.boundingBox()
  const h = Array.isArray(probe) ? undefined : await probe.boundingBox()
  if (b === null || h === null) throw new Error('not visible')
  // Box pixels to read: only for `inner` (the share), none for points.
  const [w, pad] = [h ? Math.floor(b.width) : 0, h ? 1 : 0]
  const clip = {
    x: b.x - pad,
    y: b.y - pad,
    width: b.width + 2 * pad,
    height: b.height + 2 * pad,
  }
  const off = (v: number, at: number, size: number) =>
    v < at - 3 || v >= at + size + 3
  const ring = Array.from({ length: w * Math.floor(b.height) }, (_, i) => ({
    x: i % w,
    y: Math.floor(i / w),
  })).filter(
    ({ x, y }) =>
      h && (off(x + b.x, h.x, h.width) || off(y + b.y, h.y, h.height)),
  )
  const png = (await box.page().screenshot({ clip, scale: 'css' })).toString(
    'base64',
  )
  const rgba = await box.page().evaluate(
    async ({ png, pts, pad }) => {
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0))
      const img = await createImageBitmap(new Blob([bytes]))
      const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d')
      if (ctx === null) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0)
      const { data, width } = ctx.getImageData(0, 0, img.width, img.height)
      const at = (x: number, y: number) =>
        (Math.round(y + pad) * width + Math.round(x + pad)) * 4
      return pts.map(({ x, y }) => [...data.subarray(at(x, y), at(x, y) + 4)])
    },
    {
      png,
      pad,
      pts: Array.isArray(probe) ? probe : [{ x: -1, y: -1 }, ...ring],
    },
  )
  if (Array.isArray(probe)) return rgba
  const [bg = [], ...rest] = rgba
  return (
    rest.filter((c) => c.some((v, k) => Math.abs(v - (bg[k] ?? 0)) > 2))
      .length / rest.length
  )
}
