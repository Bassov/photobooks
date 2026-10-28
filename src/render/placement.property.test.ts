import { expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { sourceCropRect, type RectMm } from '../core'
import { frameBox, imageCropBox } from './frameBox'

const numRuns = Number(process.env.FC_NUM_RUNS ?? 100)

const dim = fc.double({ min: 5, max: 600, noNaN: true })
const aspect = fc.double({ min: 0.1, max: 10, noNaN: true })
const frame = fc
  .tuple(dim, dim)
  .map(([width, height]): RectMm => ({ x: 0, y: 0, width, height }))
const zoom = fc.double({ min: 1, max: 8, noNaN: true })
const center = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})
const scale = fc.double({ min: 0.01, max: 4, noNaN: true })

/** Rendered image size in px: the frame box times the crop box percentages. */
function renderedImage(rect: RectMm, a: number, pxPerMm: number, z = 1) {
  const crop = imageCropBox(
    sourceCropRect(rect, { zoom: z, center: { x: 0.5, y: 0.5 } }, a, 'fill'),
  )
  const box = frameBox(rect, pxPerMm)
  return {
    box,
    width: (box.width * parseFloat(crop.width)) / 100,
    height: (box.height * parseFloat(crop.height)) / 100,
  }
}

test.prop([frame, aspect, zoom, center, fc.constantFrom('fill', 'fit')], {
  numRuns,
})(
  'photo aspect is preserved at any frame, zoom and fit mode',
  (rect, a, z, c, fit) => {
    const win = sourceCropRect(rect, { zoom: z, center: c }, a, fit)
    const imgW = rect.width / win.width
    const imgH = rect.height / win.height
    expect(imgW / imgH).toBeCloseTo(a, 6)
  },
)

test.prop([frame, aspect, zoom, center], { numRuns })(
  'cover fills the frame: the crop window stays inside the photo',
  (rect, a, z, c) => {
    const win = sourceCropRect(rect, { zoom: z, center: c }, a, 'fill')
    const eps = 1e-9
    expect(win.x).toBeGreaterThanOrEqual(-eps)
    expect(win.y).toBeGreaterThanOrEqual(-eps)
    expect(win.x + win.width).toBeLessThanOrEqual(1 + eps)
    expect(win.y + win.height).toBeLessThanOrEqual(1 + eps)
  },
)

// Zoom 1 only: zoomed-in contain legitimately crops past the frame edge.
test.prop([frame, aspect, center], { numRuns })(
  'contain never upscales past the frame: whole photo fits, one axis touches',
  (rect, a, c) => {
    const win = sourceCropRect(rect, { zoom: 1, center: c }, a, 'fit')
    const imgW = rect.width / win.width
    const imgH = rect.height / win.height
    const eps = 1e-9
    expect(win.width).toBeGreaterThanOrEqual(1 - eps)
    expect(win.height).toBeGreaterThanOrEqual(1 - eps)
    expect(imgW).toBeLessThanOrEqual(rect.width + eps)
    expect(imgH).toBeLessThanOrEqual(rect.height + eps)
    expect(Math.max(imgW / rect.width, imgH / rect.height)).toBeCloseTo(1, 6)
  },
)

test.prop([frame, aspect, zoom, scale, scale], { numRuns })(
  'placement math is scale-free: same aspect and frame ratios at any px-per-mm',
  (rect, a, z, canvasScale, thumbScale) => {
    const canvas = renderedImage(rect, a, canvasScale, z)
    const thumb = renderedImage(rect, a, thumbScale, z)
    // Rendered image keeps the photo aspect (percent rounding ≤ 0.001%).
    expect(canvas.width / canvas.height / a).toBeCloseTo(1, 2)
    expect(thumb.width / thumb.height / a).toBeCloseTo(1, 2)
    // Thumb is the canvas scaled uniformly: same image/frame ratios.
    expect(thumb.width / thumb.box.width).toBeCloseTo(
      canvas.width / canvas.box.width,
      2,
    )
    expect(thumb.height / thumb.box.height).toBeCloseTo(
      canvas.height / canvas.box.height,
      2,
    )
  },
)
