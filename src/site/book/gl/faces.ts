/*
 * Page faces for the GL reader (Designer D39): each printed page painted by
 * `paintPage`, grain after painting (the kit's `faceCanvas` shape). Faces
 * paint lazily, one at a time: the focused view and views ± 2 first. Paint and
 * each grain band are separate tasks with a yield before each band, so
 * painting never holds the main thread for a long task.
 */
import { pagesOf, type Book } from '../../../core'
import { paintPage, type PageImage } from '../../../render/pagePainter'
import { ctx, cv, grain, GRAIN_BAND_PX, nextTask, rowBands } from './canvas'
import { viewOfPage, type GlFace } from './types'

/** views around the focused one that paint before the rest */
const NEAR = 2
/**
 * Texels per paint band: Chromium rasterizes a page's draws (the photo's
 * high-quality resample) at the end of the painting task, so a 2× page
 * (1200 × 1600) paints in 4 clipped bands, one per task.
 */
export const PAINT_BAND_PX = 1 << 19

export interface FaceSourceOptions {
  book: Book
  /** decoded photos of physical page `page` (1-based) */
  images: (page: number) => Promise<ReadonlyMap<string, PageImage>>
  /** face width in device px (css page width × devicePixelRatio) */
  pagePx: number
  /** the next task; default `setTimeout` 0 */
  yieldTask?: () => Promise<void>
}

export interface FaceSource {
  /** the GL input's face provider */
  readonly face: GlFace
  /** the reader shows view `view`: it and views ± 2 paint first (and are queued now) */
  focus(view: number): void
  dispose(): void
}

/**
 * The order to paint `pending` pages (in request order) with view `view`
 * focused: pages within ± 2 views by distance, then the rest as requested.
 */
export function paintOrder(pending: readonly number[], view: number): number[] {
  const dist = (page: number) => Math.abs(viewOfPage(page) - view)
  const near = pending.filter((page) => dist(page) <= NEAR)
  const far = pending.filter((page) => dist(page) > NEAR)
  return [...near.sort((a, b) => dist(a) - dist(b) || a - b), ...far]
}

interface Job {
  promise: Promise<HTMLCanvasElement>
  resolve: (c: HTMLCanvasElement) => void
  reject: (e: unknown) => void
}

export function createFaceSource(o: FaceSourceOptions): FaceSource {
  const { book, pagePx } = o
  const yieldTask = o.yieldTask ?? nextTask
  const { widthMm, heightMm } = book.settings.trim
  const pages = pagesOf(book.spreads.length)
  const jobs = new Map<number, Job>()
  let pending: number[] = []
  let view = 1
  let running = false
  let dead = false

  const job = (page: number): Job => {
    let j = jobs.get(page)
    if (j) return j
    let resolve: Job['resolve'] = () => undefined
    let reject: Job['reject'] = () => undefined
    const promise = new Promise<HTMLCanvasElement>((res, rej) => {
      resolve = res
      reject = rej
    })
    // faces queued by `focus` may have no reader: their failure is not unhandled
    promise.catch(() => undefined)
    j = { promise, resolve, reject }
    jobs.set(page, j)
    pending.push(page)
    void pump()
    return j
  }

  async function paint(page: number) {
    const c = cv(pagePx, (pagePx * heightMm) / widthMm)
    const x = ctx(c)
    const images = await o.images(page + 1)
    for (const [y0, y1] of rowBands(c.width, c.height, PAINT_BAND_PX)) {
      if (y0 > 0) await yieldTask()
      if (dead) return c
      // the canvas rasterizes this band's draws at the end of the task
      x.save()
      x.beginPath()
      x.rect(0, y0, c.width, y1 - y0)
      x.clip()
      await paintPage(x, book, page + 1, images, pagePx / widthMm)
      x.restore()
    }
    for (const [y0, y1] of rowBands(c.width, c.height, GRAIN_BAND_PX, 2)) {
      await yieldTask()
      if (dead) return c
      grain(x, c.width, c.height, 5, 2, y0, y1)
    }
    return c
  }

  async function pump() {
    if (running) return
    running = true
    // the requests of this task queue up before the first pick, and painting
    // never runs in the caller's task
    await yieldTask()
    while (!dead && pending.length > 0) {
      const [page, ...rest] = paintOrder(pending, view) as [number, ...number[]]
      pending = rest
      const j = jobs.get(page)
      try {
        j?.resolve(await paint(page))
      } catch (e) {
        j?.reject(e)
      }
      await yieldTask()
    }
    running = false
  }

  return {
    face: (page) => job(page).promise,
    focus(v) {
      view = v
      for (let page = 0; page < pages; page++) {
        if (Math.abs(viewOfPage(page) - v) <= NEAR) job(page)
      }
    },
    dispose() {
      dead = true
      for (const page of pending) jobs.get(page)?.reject(new Error('disposed'))
      pending = []
    },
  }
}
