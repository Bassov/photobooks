import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, test } from './fixtures/coverage'

/*
 * Painter parity (Designer D39): `paintPage` vs `SpreadView` at the same
 * px/mm. Neither is wired into a prod screen yet, so a test-only IIFE (never
 * shipped) bundles them with the fixture book and runs on `/`, where the
 * tokens and the kit font faces are loaded.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const src = (path: string): string => JSON.stringify(`${root}src/${path}`)

/** Compare scale: a 150 × 200 mm page is 300 × 400 px. */
const PX_PER_MM = 2
/** 2× of a 600 px reader page. */
const HIRES_PX_PER_MM = 8

const HARNESS = `
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { SpreadView } from ${src('render/SpreadView.tsx')}
import { paintPage } from ${src('render/pagePainter.ts')}
import { resolveSpread, setParentPageNumbers } from ${src('core/index.ts')}
import { makeBook, makeFrame, makeSpread } from ${src('core/testing/fixtures.ts')}

const PHOTOS = { a: [1600, 1067, 20], b: [1500, 1000, 200], c: [900, 1350, 320] }

async function photo([w, h, hue]) {
  const canvas = new OffscreenCanvas(w, h)
  const g = canvas.getContext('2d')
  const sky = g.createLinearGradient(0, 0, w * 0.3, h)
  sky.addColorStop(0, 'hsl(' + hue + ' 70% 75%)')
  sky.addColorStop(1, 'hsl(' + (hue + 60) + ' 55% 30%)')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 9; i += 1) {
    g.fillStyle = 'hsl(' + (hue + i * 37) + ' 60% ' + (35 + i * 6) + '%)'
    g.beginPath()
    g.arc(((i * 211) % 97) / 97 * w, ((i * 137) % 89) / 89 * h, (0.06 + (i % 4) * 0.04) * w, 0, 7)
    g.fill()
  }
  g.fillStyle = 'hsl(' + (hue + 180) + ' 40% 20%)'
  g.fillRect(w * 0.1, h * 0.7, w * 0.8, h * 0.08)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return { url: URL.createObjectURL(blob), bitmap: await createImageBitmap(blob) }
}

const text = (id, rect, styleId, align, body) =>
  makeFrame({ id, rect, kind: 'text', styleId, align, content: { type: 'static', text: body } })

function fixtureBook() {
  const crop = (zoom, x, y, more) => ({ zoom, center: { x, y }, ...more })
  const book = makeBook({
    settings: { trim: { widthMm: 150, heightMm: 200 } },
    assets: Object.fromEntries(
      Object.entries(PHOTOS).map(([id, [widthPx, heightPx]]) => [id, { widthPx, heightPx }]),
    ),
    gallery: Object.keys(PHOTOS),
    frameStyles: {
      look: { strokeMm: 0.6, strokeColor: '#1c1b1a', matMm: 2, matColor: '#f4efe6', cornerRadiusMm: 3 },
    },
    parents: [{ id: 'pA', name: 'Master A', frames: [], guides: [] }],
    defaultParentId: 'pA',
    spreads: [
      makeSpread({
        id: 's0',
        frames: [
          text('title', { x: 15, y: 18, width: 120, height: 20.7 }, 'title', 'center', 'A week of salt, light and long afternoons'),
          makeFrame({
            id: 'cap', z: 1, rect: { x: 20, y: 45, width: 110, height: 60 }, assetId: 'b',
            crop: crop(1, 0.5, 0.5), caption: 'Morning light over the harbour on the first day, before the ferries and the crowds arrived',
          }),
          text('body', { x: 20, y: 122, width: 110, height: 37.8 }, 'body', 'left',
            'We walked down to the water before breakfast. The town was still asleep, and the only sound was the gulls and a radio somewhere above the bakery.\\nBy noon the square was full.'),
        ],
      }),
      makeSpread({
        id: 's1',
        frames: [
          makeFrame({ id: 'bleed', rect: { x: -3, y: -3, width: 153, height: 206 }, assetId: 'a', crop: crop(1, 0.5, 0.5) }),
          makeFrame({
            id: 'zoom', z: 1, rect: { x: 165, y: 15, width: 120, height: 80 }, assetId: 'b',
            crop: crop(1.8, 0.3, 0.6), adjust: { brightness: 10, contrast: -15, saturation: 20 },
          }),
          makeFrame({
            id: 'turn', z: 2, rect: { x: 170, y: 105, width: 55, height: 75 }, assetId: 'c', rotationDeg: 7,
            frameStyleId: 'look', crop: crop(1.2, 0.5, 0.5, { quarterTurns: 1, straightenDeg: 6, flipH: true }),
          }),
          makeFrame({
            id: 'tilt', z: 3, rect: { x: 232, y: 112, width: 50, height: 60 }, assetId: 'a',
            crop: crop(1.4, 0.6, 0.4, { straightenDeg: -9 }),
          }),
        ],
      }),
      makeSpread({
        id: 's2',
        frames: [
          makeFrame({ id: 'last', rect: { x: 25, y: 30, width: 100, height: 130 }, assetId: 'c', crop: crop(1, 0.5, 0.5) }),
          text('end', { x: 25, y: 166, width: 100, height: 10.8 }, 'body', 'right', 'The end of the summer'),
        ],
      }),
    ],
  })
  return setParentPageNumbers(book, 'pA', 'outer')
}

/** Lines of a DOM text box: characters grouped by their line box top. */
function domLines(node) {
  const textNode = node.firstChild
  const lines = []
  let top
  const range = document.createRange()
  for (let i = 0; i < (textNode?.length ?? 0); i += 1) {
    const char = textNode.data[i]
    if (char === '\\n') { top = undefined; lines.push(''); continue }
    range.setStart(textNode, i)
    range.setEnd(textNode, i + 1)
    const rect = range.getClientRects()[0]
    if (char !== ' ' && rect !== undefined && Math.round(rect.top) !== top) {
      if (top !== undefined) lines.push('')
      top = Math.round(rect.top)
      if (lines.length === 0) lines.push('')
    }
    if (lines.length === 0) lines.push('')
    lines[lines.length - 1] += char
  }
  return lines.map((line) => line.trimEnd())
}

const lab = (r, g, b) => {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047)
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

let state

window.__painterHarness = {
  async mount(page, pxPerMm) {
    const book = fixtureBook()
    const entries = await Promise.all(Object.entries(PHOTOS).map(async ([id, spec]) => [id, await photo(spec)]))
    const photos = Object.fromEntries(entries)
    const images = new Map(entries.map(([id, p]) => [id, p.bitmap]))
    const index = Math.floor(page / 2)
    const spreadId = book.spreads[index].id
    const resolved = resolveSpread(book, spreadId, {
      getAspectRatio: (id) => images.get(id).width / images.get(id).height,
    })
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;background:#fff'
    document.body.append(host)
    flushSync(() => {
      createRoot(host).render(
        createElement(SpreadView, { spreadId, resolved, pxPerMm, previewUrlFor: (id) => photos[id]?.url }),
      )
    })
    await Promise.all([...host.querySelectorAll('img')].map((img) => img.decode()))
    await document.fonts.ready
    const two = index > 0 && index < book.spreads.length - 1
    const left = two && page % 2 === 1 ? 150 * pxPerMm : 0
    const [width, height] = [150 * pxPerMm, 200 * pxPerMm]
    const inPage = (r) => r.right > left && r.left < left + width
    const textNodes = [...host.querySelectorAll('[data-testid="frame-text"]')]
      .filter((node) => inPage(node.getBoundingClientRect()))
    const masks = [...host.querySelectorAll('[data-testid="frame-text"], [data-testid="frame-caption"], [data-testid="page-number"]')]
      .map((node) => node.getBoundingClientRect())
      .filter(inPage)
      .map((r) => ({ x: r.left - left - 2, y: r.top - 2, right: r.right - left + 2, bottom: r.bottom + 2 }))
    state = { book, images, page, masks, width, height }
    return { clip: { x: left, y: 0, width, height }, domLines: textNodes.map(domLines).flat() }
  },
  async paint(pxPerMm) {
    const { book, images, page } = state
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(150 * pxPerMm)
    canvas.height = Math.round(200 * pxPerMm)
    const ctx = canvas.getContext('2d')
    const lines = []
    const fillText = ctx.fillText.bind(ctx)
    ctx.fillText = (value, x, y) => {
      if (/system-ui|Georgia/.test(ctx.font)) lines.push(value)
      fillText(value, x, y)
    }
    const longTasks = []
    const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries()))
    observer.observe({ type: 'longtask' })
    const start = performance.now()
    await paintPage(ctx, book, page, images, pxPerMm)
    const end = performance.now()
    await new Promise((resolve) => setTimeout(resolve, 500))
    observer.disconnect()
    state.canvas = canvas
    const longest = Math.max(0, ...longTasks
      .filter((t) => t.startTime < end && t.startTime + t.duration > start)
      .map((t) => t.duration))
    return { lines, longest }
  },
  async compare(pngBase64) {
    const { canvas, masks, width, height } = state
    const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0))
    const shot = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const dom = new OffscreenCanvas(width, height).getContext('2d')
    dom.drawImage(shot, 0, 0)
    const a = dom.getImageData(0, 0, width, height).data
    const b = canvas.getContext('2d').getImageData(0, 0, width, height).data
    let [count, sum, over] = [0, 0, 0]
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (masks.some((m) => x >= m.x && x < m.right && y >= m.y && y < m.bottom)) continue
        const i = (y * width + x) * 4
        const [l1, a1, b1] = lab(a[i], a[i + 1], a[i + 2])
        const [l2, a2, b2] = lab(b[i], b[i + 1], b[i + 2])
        const delta = Math.hypot(l1 - l2, a1 - a2, b1 - b2)
        count += 1
        sum += delta
        if (delta > 10) over += 1
      }
    }
    return { mean: sum / count, overShare: over / count, count }
  },
}
`

interface PainterHarness {
  mount(
    page: number,
    pxPerMm: number,
  ): Promise<{
    clip: { x: number; y: number; width: number; height: number }
    domLines: string[]
  }>
  paint(pxPerMm: number): Promise<{ lines: string[]; longest: number }>
  compare(
    pngBase64: string,
  ): Promise<{ mean: number; overShare: number; count: number }>
}

declare global {
  interface Window {
    // Set by the injected bundle in `beforeEach`, before any evaluate.
    __painterHarness: PainterHarness
  }
}

let bundle: { js: string; css: string }

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'page-painter-harness',
        resolveId: (id) => (id === 'virtual:harness' ? '\0harness' : null),
        load: (id) => (id === '\0harness' ? HARNESS : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      rolldownOptions: { input: 'virtual:harness', output: { format: 'iife' } },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((out) =>
    'output' in out ? out.output : [],
  )
  bundle = {
    js: outputs.map((o) => (o.type === 'chunk' ? o.code : '')).join('\n'),
    css: outputs
      .map((o) =>
        o.type === 'asset' && o.fileName.endsWith('.css')
          ? String(o.source)
          : '',
      )
      .join('\n'),
  }
})

const FIXTURES = [
  { name: 'full bleed', page: 2 },
  { name: '3 photos with crop + rotation', page: 3 },
  { name: 'text frame + caption', page: 1 },
  { name: 'folio', page: 4 },
] as const

test.describe('page painter parity with SpreadView', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.addStyleTag({
      content: `${bundle.css}\n[data-testid='spread-page-cut'] { display: none }`,
    })
    await page.addScriptTag({ content: bundle.js })
  })

  for (const fixture of FIXTURES) {
    test(`${fixture.name}: ΔE and line breaks match`, async ({ page }) => {
      const mounted = await page.evaluate(
        ([n, scale]) => window.__painterHarness.mount(n, scale),
        [fixture.page, PX_PER_MM] as const,
      )
      const painted = await page.evaluate(
        (scale) => window.__painterHarness.paint(scale),
        PX_PER_MM,
      )
      const shot = await page.screenshot({ clip: mounted.clip })
      const stats = await page.evaluate(
        (png) => window.__painterHarness.compare(png),
        shot.toString('base64'),
      )
      expect(stats.count).toBeGreaterThan(0)
      expect(stats.mean).toBeLessThanOrEqual(2)
      expect(stats.overShare).toBeLessThanOrEqual(0.01)
      expect(painted.lines).toEqual(mounted.domLines)
    })
  }

  test('one page at 2× paints without a long task over 50 ms', async ({
    page,
  }) => {
    await page.evaluate(
      ([n, scale]) => window.__painterHarness.mount(n, scale),
      [3, PX_PER_MM] as const,
    )
    const painted = await page.evaluate(
      (scale) => window.__painterHarness.paint(scale),
      HIRES_PX_PER_MM,
    )
    expect(painted.longest).toBeLessThanOrEqual(50)
  })
})
