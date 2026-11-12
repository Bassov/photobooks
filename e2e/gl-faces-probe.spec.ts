import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build, type Manifest, type Rolldown } from 'vite'
import { expect, test } from './fixtures/coverage'

/*
 * The GL book (Designer D44) before any screen uses it: a test-only IIFE
 * (never shipped) paints faces with `createFaceSource` and records long
 * tasks; a build of the site entry next to a probe entry that imports the GL
 * modules lazily checks the bundle shape from the build manifest.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const src = (path: string): string => JSON.stringify(`${root}src/${path}`)
const GL = 'src/site/book/gl/'

/** 2× of a 600 px reader page. */
const PAGE_PX = 1200

const HARNESS = `
import { createFaceSource } from ${src('site/book/gl/faces.ts')}
import { makeBook, makeFrame, makeSpread } from ${src('core/testing/fixtures.ts')}

async function photo(w, h, hue) {
  const canvas = new OffscreenCanvas(w, h)
  const g = canvas.getContext('2d')
  const sky = g.createLinearGradient(0, 0, w * 0.3, h)
  sky.addColorStop(0, 'hsl(' + hue + ' 70% 75%)')
  sky.addColorStop(1, 'hsl(' + (hue + 60) + ' 55% 30%)')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  return createImageBitmap(canvas)
}

const crop = { zoom: 1, center: { x: 0.5, y: 0.5 } }
const book = makeBook({
  settings: { trim: { widthMm: 150, heightMm: 200 } },
  assets: { a: { widthPx: 1600, heightPx: 1067 }, b: { widthPx: 1067, heightPx: 1600 } },
  gallery: ['a', 'b'],
  spreads: [0, 1, 2, 3].map((i) =>
    makeSpread({
      id: 's' + i,
      frames: [
        makeFrame({ id: 'p' + i, rect: { x: -3, y: -3, width: 306, height: 206 }, assetId: i % 2 ? 'b' : 'a', crop }),
        makeFrame({
          id: 't' + i, z: 1, kind: 'text', styleId: 'body', align: 'left',
          rect: { x: 165, y: 20, width: 110, height: 40 },
          content: { type: 'static', text: 'The town was still asleep, and the only sound was the gulls.' },
        }),
      ],
    }),
  ),
})

window.__glFaces = {
  async run(pagePx) {
    const images = new Map([['a', await photo(1600, 1067, 20)], ['b', await photo(1067, 1600, 200)]])
    const longTasks = []
    const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries()))
    observer.observe({ type: 'longtask' })
    const start = performance.now()
    const source = createFaceSource({ book, images: async () => images, pagePx })
    source.focus(1)
    const faces = await Promise.all([0, 1, 2, 3, 4, 5].map((page) => source.face(page)))
    const end = performance.now()
    await new Promise((resolve) => setTimeout(resolve, 500))
    observer.disconnect()
    const longest = Math.max(0, ...longTasks
      .filter((t) => t.startTime < end && t.startTime + t.duration > start)
      .map((t) => t.duration))
    const painted = faces.map((c) => {
      const [r, g, b] = c.getContext('2d').getImageData(c.width / 4, c.height / 2, 1, 1).data
      return r + g + b < 3 * 240
    })
    return { sizes: faces.map((c) => [c.width, c.height]), painted, longest }
  },
}
`

interface FacesHarness {
  run(pagePx: number): Promise<{
    sizes: [number, number][]
    painted: boolean[]
    longest: number
  }>
}

declare global {
  interface Window {
    __glFaces: FacesHarness
  }
}

const chunksOf = (result: Awaited<ReturnType<typeof build>>) =>
  (Array.isArray(result) ? result : [result]).flatMap((out) =>
    'output' in out ? out.output : [],
  )

test.describe('GL book faces', () => {
  let bundle: string

  test.beforeAll(async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      root,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'gl-faces-harness',
          resolveId: (id) => (id === 'virtual:harness' ? '\0harness' : null),
          load: (id) => (id === '\0harness' ? HARNESS : null),
        },
      ],
      build: {
        write: false,
        minify: false,
        rolldownOptions: {
          input: 'virtual:harness',
          output: { format: 'iife' },
        },
      },
    })
    bundle = chunksOf(result)
      .map((o) => (o.type === 'chunk' ? o.code : ''))
      .join('\n')
  })

  test('6 pages at 2× paint without a long task over 50 ms', async ({
    page,
  }) => {
    await page.goto('/')
    await page.addScriptTag({ content: bundle })

    const run = await page.evaluate((px) => window.__glFaces.run(px), PAGE_PX)

    expect(run.sizes).toEqual(Array.from({ length: 6 }, () => [1200, 1600]))
    expect(run.painted).toEqual(Array.from({ length: 6 }, () => true))
    expect(run.longest).toBeLessThanOrEqual(50)
  })
})

/** `vite.config.ts` reads these at load: no Istanbul (e2e coverage), no Codecov bundle upload */
async function withCleanEnv<T>(run: () => Promise<T>): Promise<T> {
  const saved = {
    VITE_COVERAGE: process.env.VITE_COVERAGE,
    CODECOV_TOKEN: process.env.CODECOV_TOKEN,
  }
  process.env.VITE_COVERAGE = '0'
  delete process.env.CODECOV_TOKEN
  try {
    return await run()
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key)
      else process.env[key] = value
    }
  }
}

/** the real build of the site entry next to a probe entry importing the GL modules lazily */
async function siteBundle() {
  const result = await withCleanEnv(() =>
    build({
      root,
      logLevel: 'silent',
      plugins: [
        {
          name: 'gl-bundle-probe',
          resolveId: (id) => (id === 'virtual:gl-probe' ? '\0gl-probe' : null),
          load: (id) =>
            id === '\0gl-probe'
              ? // a global, not an export: the build drops unused entry exports
                `globalThis.glProbe = () => Promise.all([
                  import(${src('site/book/gl/closed.ts')}),
                  import(${src('site/book/gl/open.ts')}),
                  import(${src('site/book/gl/curl.ts')}),
                  import(${src('site/book/gl/faces.ts')}),
                  import(${src('site/book/gl/three.ts')}).then((m) => m.loadThree()),
                ])`
              : null,
          config(config) {
            config.build ??= {}
            config.build.rolldownOptions = {
              ...config.build.rolldownOptions,
              input: { site: 'site.html', glProbe: 'virtual:gl-probe' },
            }
          },
        },
      ],
      build: { write: false, manifest: true },
    }),
  )
  const outputs = chunksOf(result)
  const manifestAsset = outputs.find(
    (o): o is Rolldown.OutputAsset =>
      o.type === 'asset' && o.fileName === '.vite/manifest.json',
  )
  const manifest = JSON.parse(String(manifestAsset?.source)) as Manifest
  const chunks = new Map(
    outputs.flatMap((o) => (o.type === 'chunk' ? [[o.fileName, o]] : [])),
  )
  /** the manifest keys an entry loads up front: itself and its static imports */
  const upFront = (key: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(key)) return seen
    seen.add(key)
    for (const imported of manifest[key]?.imports ?? []) upFront(imported, seen)
    return seen
  }
  const chunksOfKeys = (keys: Set<string>) =>
    [...keys].flatMap((key) => {
      const chunk = chunks.get(manifest[key]?.file ?? '')
      return chunk ? [chunk] : []
    })
  const probeKey = Object.keys(manifest).find(
    (key) => manifest[key]?.name === 'glProbe',
  )
  const site = chunksOfKeys(upFront('site.html'))
  const probe = chunksOfKeys(upFront(probeKey ?? ''))
  const glIn = (list: Rolldown.OutputChunk[]) =>
    list.flatMap((c) => c.moduleIds.filter((id) => id.includes(GL)))
  return {
    manifest,
    siteChunks: site.length,
    probeChunks: probe.length,
    siteGzipKb:
      site.reduce((sum, c) => sum + gzipSync(c.code).length, 0) / 1024,
    glInSite: glIn(site),
    glInProbe: glIn(probe),
  }
}

test.describe('GL book bundle', () => {
  test('the site entry stays ≤ 200 KB; GL code and three load lazily', async () => {
    test.setTimeout(240_000)

    const b = await siteBundle()

    const three = b.manifest[`${GL}vendor/three.module.min.js`]
    // `three.ts` itself rides in a shared chunk (closed / open / curl import it); `glInSite` keeps it off the entry
    const lazy = ['closed', 'open', 'curl', 'faces'].map(
      (key) => b.manifest[`${GL}${key}.ts`]?.isDynamicEntry,
    )
    expect(b.siteChunks).toBeGreaterThan(0)
    expect(b.probeChunks).toBeGreaterThan(0)
    expect(b.siteGzipKb).toBeLessThanOrEqual(200)
    expect(b.glInSite).toEqual([])
    expect(b.glInProbe).toEqual([])
    expect(three?.isDynamicEntry).toBe(true)
    expect(three?.isEntry).toBeFalsy()
    expect(lazy).toEqual([true, true, true, true])
  })
})
