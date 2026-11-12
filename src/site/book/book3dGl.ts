/*
 * The home's GL books (Designer personal-site P4, D38, D42): loaded lazily by
 * `Book3D` after `load` + idle, so the site entry never pulls `gl/` or three.
 * Site data → `GlBookInput`; each face-out is drawn once into a canvas that
 * replaces the CSS faces in place. Any failure keeps the CSS book.
 */
import type { SiteCatalogBook } from '../siteInput'
import { imageSrc } from '../siteUrl'
import { ctx, cv } from './gl/canvas'
import { canvasBox, ClosedBook, type GlPose } from './gl/closed'
import { drawInto, glWanted, loadThree, type Three } from './gl/three'
import { glBook, thickCm, type GlBookInput } from './gl/types'

/** the kit's face-out pose (ry 0, rx 3.5) in GL terms: elev = 20 + (−rx − 14) · 0.8 */
export const FACE_OUT: GlPose = { ry: 0, elev: 6, lift: 0, peek: 0, rz: 0 }
const FONT = '"Site Inter Display", system-ui, sans-serif'

/** the front panel: cloth, the cover photo (cover-fit), the title in the cover type (D38) */
export function frontPanel(
  b: SiteCatalogBook,
  photo: CanvasImageSource | null,
  px: number,
): HTMLCanvasElement {
  const W = px
  const H = Math.round((px * b.trimMm.h) / b.trimMm.w)
  const c = cv(W, H)
  const x = ctx(c)
  x.fillStyle = b.spine.cloth
  x.fillRect(0, 0, W, H)
  if (photo !== null) {
    const { iw, ih } = sizeOf(photo)
    const k = Math.max(W / iw, H / ih)
    x.drawImage(photo, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k)
  }
  const size = 0.1 * Math.min(W, H)
  x.font = `500 ${String(size)}px ${FONT}`
  x.letterSpacing = `${(-0.025 * size).toFixed(2)}px`
  x.fillStyle = b.ink
  x.textAlign = 'left'
  x.textBaseline = b.place === 'top' ? 'top' : 'bottom'
  x.fillText(b.title, 0.08 * W, b.place === 'top' ? 0.09 * H : 0.91 * H)
  return c
}

/** the spine panel, top → bottom: the cloth, the spine text at the head, the year at the foot */
export function spinePanel(b: SiteCatalogBook, px: number): HTMLCanvasElement {
  const H = px
  // the drawn thickness at this scale (the GL book's 12 px floor included)
  const T = thickCm({ pages: b.pageCount }, px / (b.trimMm.h / 10))
  const W = Math.max(8, Math.round((H * T) / (b.trimMm.h / 10)))
  const c = cv(W, H)
  const x = ctx(c)
  x.fillStyle = b.spine.cloth
  x.fillRect(0, 0, W, H)
  const size = Math.min(W * 0.42, H * 0.045)
  x.fillStyle = b.spine.ink
  x.textBaseline = 'middle'
  x.translate(W / 2, 0)
  x.rotate(Math.PI / 2)
  x.font = `500 ${String(size)}px ${FONT}`
  x.textAlign = 'left'
  x.fillText(b.spine.text, 0.1 * H, 0)
  x.font = `400 ${String(size * 0.7)}px ${FONT}`
  x.textAlign = 'right'
  x.fillText(String(b.year), 0.92 * H, 0)
  return c
}

/** the back panel: the cloth */
export function backPanel(b: SiteCatalogBook): HTMLCanvasElement {
  const c = cv(4, 4)
  const x = ctx(c)
  x.fillStyle = b.spine.cloth
  x.fillRect(0, 0, 4, 4)
  return c
}

/** D38: site facts → the GL book; the closed book draws no pages, so faces are blank paper */
export function glInput(
  b: SiteCatalogBook,
  photo: CanvasImageSource | null,
  px: number,
): GlBookInput {
  const paper = cv(4, 4)
  const p = ctx(paper)
  p.fillStyle = b.paper
  p.fillRect(0, 0, 4, 4)
  return {
    cover: {
      front: frontPanel(b, photo, px),
      spine: spinePanel(b, Math.round((px * b.trimMm.h) / b.trimMm.w)),
      back: backPanel(b),
    },
    cloth: b.spine.cloth,
    pageCount: b.pageCount,
    trimMm: { widthMm: b.trimMm.w, heightMm: b.trimMm.h },
    paper: b.paper,
    endpaper: b.endpaper,
    face: () => Promise.resolve(paper),
  }
}

function sizeOf(img: CanvasImageSource): { iw: number; ih: number } {
  if (img instanceof HTMLImageElement) {
    return { iw: img.naturalWidth || 1, ih: img.naturalHeight || 1 }
  }
  const { width, height } = img as { width: number; height: number }
  return { iw: width || 1, ih: height || 1 }
}

export async function photoOf(
  src: string | undefined,
): Promise<HTMLImageElement | null> {
  if (src === undefined) return null
  const img = new Image()
  img.src = imageSrc(src)
  await img.decode()
  return img
}

export interface GlDeps {
  wanted: () => boolean
  three: () => Promise<Three>
}
const DEPS: GlDeps = { wanted: glWanted, three: loadThree }

/**
 * Draw `b` face-out at `s` px/cm into a canvas inside `host` (the CSS book's
 * W×H box) and mark the host `data-gl="ready"`; resolves to a cleanup.
 * Without GL (`?gl=0`, no WebGL2, file:) nothing happens.
 */
export async function drawHomeBook(
  host: HTMLElement,
  b: SiteCatalogBook,
  s: number,
  deps: GlDeps = DEPS,
): Promise<() => void> {
  if (!deps.wanted()) return () => undefined
  const k = Math.max(2, window.devicePixelRatio)
  const [T, photo] = await Promise.all([
    deps.three(),
    photoOf(b.cover?.src),
    document.fonts.load(`500 16px ${FONT}`),
  ])
  const px = Math.min(1024, Math.ceil((b.trimMm.w / 10) * s * k * 1.5))
  const book = new ClosedBook(T, glBook(glInput(b, photo, px)), s, {
    dark: false,
    floor: false,
    k,
  })
  book.pose(FACE_OUT)
  const box = canvasBox({ w: b.trimMm.w / 10, h: b.trimMm.h / 10 }, s)
  const out = cv(box.width * k, box.height * k)
  out.className = 'sd-b3gl'
  Object.assign(out.style, {
    left: `${String(box.left)}px`,
    top: `${String(box.top)}px`,
    width: `${String(box.width)}px`,
    height: `${String(box.height)}px`,
  })
  out.setAttribute('aria-hidden', 'true')
  drawInto(T, book.scene, book.cam, out)
  book.dispose()
  host.append(out)
  host.dataset.gl = 'ready'
  return () => {
    out.remove()
    delete host.dataset.gl
  }
}
