import { readFileSync } from 'node:fs'
import { expect, test } from '../fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../fixtures/ensurePhotoFixtures'

/**
 * Thumb decode measurement (thumb-scaled-decode): the worker decode entry on
 * `large-24mp.jpg`, `ImageDecoder` path vs the `createImageBitmap` fallback
 * (ImageDecoder hidden), alternating in one browser run. Medians go to the
 * test attachment and stdout for the PR body; only tier sizes are asserted.
 */

const BENCH_URL = '/__bench/large-24mp.jpg'
const WARMUP_RUNS = 2
const MEASURED_RUNS = 9

interface BenchRun {
  ms: number
  thumbEdge: number
  workingEdge: number | null
}

declare global {
  interface Window {
    __photobooksDecode?: {
      processPhotoRequest: (request: {
        id: string
        file: File
        maxEdge?: number
        dualTiers?: boolean
      }) => Promise<
        | {
            ok: true
            previewBuffer: ArrayBuffer
            workingBuffer?: ArrayBuffer
          }
        | { ok: false; error: string }
      >
    }
  }
}

const BENCH_KEYS = [
  'thumbBitmap',
  'thumbImageDecoder',
  'dualBitmap',
  'dualImageDecoder',
] as const
type BenchKey = (typeof BENCH_KEYS)[number]

/** Median of an odd-length run list (MEASURED_RUNS is odd). */
function medianMs(runs: readonly BenchRun[]): number {
  const sorted = runs.map((run) => run.ms).sort((a, b) => a - b)
  return Math.round(sorted[(sorted.length - 1) / 2] ?? Number.NaN)
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: true })
})

test('thumb decode: ImageDecoder vs createImageBitmap on a 24 MP JPEG', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const body = readFileSync(photoFixturePaths.largeJpeg)
  await page.route(`**${BENCH_URL}`, (route) =>
    route.fulfill({ body, contentType: 'image/jpeg' }),
  )
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => window.__photobooksDecode !== undefined))
    .toBe(true)

  const runs = await page.evaluate(
    async ({ url, warmup, measured }) => {
      const api = window.__photobooksDecode
      if (api === undefined) {
        throw new Error('window.__photobooksDecode is not available')
      }
      const { processPhotoRequest } = api
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], 'large-24mp.jpg', { type: 'image/jpeg' })
      const scope = globalThis as { ImageDecoder?: unknown }
      const nativeDecoder = scope.ImageDecoder

      async function longEdge(buffer: ArrayBuffer): Promise<number> {
        const bitmap = await createImageBitmap(new Blob([buffer]))
        const edge = Math.max(bitmap.width, bitmap.height)
        bitmap.close()
        return edge
      }

      async function once(
        path: 'imageDecoder' | 'bitmap',
        dualTiers: boolean,
      ): Promise<{
        ms: number
        thumbEdge: number
        workingEdge: number | null
      }> {
        scope.ImageDecoder = path === 'bitmap' ? undefined : nativeDecoder
        try {
          const started = performance.now()
          const result = await processPhotoRequest({
            id: 'bench',
            file,
            maxEdge: 320,
            dualTiers,
          })
          const ms = performance.now() - started
          if (!result.ok) {
            throw new Error(result.error)
          }
          return {
            ms,
            thumbEdge: await longEdge(result.previewBuffer),
            workingEdge:
              result.workingBuffer === undefined
                ? null
                : await longEdge(result.workingBuffer),
          }
        } finally {
          scope.ImageDecoder = nativeDecoder
        }
      }

      const out: Record<BenchKey, BenchRun[]> = {
        thumbBitmap: [],
        thumbImageDecoder: [],
        dualBitmap: [],
        dualImageDecoder: [],
      }
      for (let i = 0; i < warmup + measured; i += 1) {
        const keep = i >= warmup
        for (const [key, path, dual] of [
          ['thumbBitmap', 'bitmap', false],
          ['thumbImageDecoder', 'imageDecoder', false],
          ['dualBitmap', 'bitmap', true],
          ['dualImageDecoder', 'imageDecoder', true],
        ] as const) {
          const run = await once(path, dual)
          if (keep) {
            out[key].push(run)
          }
        }
      }
      return out
    },
    { url: BENCH_URL, warmup: WARMUP_RUNS, measured: MEASURED_RUNS },
  )

  const summary = Object.fromEntries(
    BENCH_KEYS.map((key) => [key, medianMs(runs[key])]),
  ) as Record<BenchKey, number>
  const report = {
    fixture: 'e2e/fixtures/large-24mp.jpg (6000x4000)',
    runs: MEASURED_RUNS,
    medianMs: summary,
    thumbRatio: summary.thumbImageDecoder / summary.thumbBitmap,
    dualRatio: summary.dualImageDecoder / summary.dualBitmap,
  }
  console.log(`thumb-decode bench ${JSON.stringify(report)}`)
  await testInfo.attach('thumb-decode-bench.json', {
    body: JSON.stringify({ report, runs }, null, 2),
    contentType: 'application/json',
  })

  for (const key of ['thumbBitmap', 'thumbImageDecoder'] as const) {
    expect(runs[key].map((run) => run.thumbEdge)).toEqual(
      Array.from({ length: MEASURED_RUNS }, () => 320),
    )
  }
  for (const key of ['dualBitmap', 'dualImageDecoder'] as const) {
    expect(runs[key].map((run) => [run.thumbEdge, run.workingEdge])).toEqual(
      Array.from({ length: MEASURED_RUNS }, () => [320, 1280]),
    )
  }
})
