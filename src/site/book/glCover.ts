/*
 * A site book's GL cover (D38): cover panels from the site facts and the
 * cover photo decode. Shared by the home's closed books (`book3dGl`) and the
 * room's open ones (`roomGl`) without either pulling in the other.
 */
import type { SiteCatalogBook } from '../siteInput'
import { imageSrc } from '../siteUrl'
import { ctx, cv } from './gl/canvas'
import { thickCm, type GlBookInput } from './gl/types'

export const FONT = '"Site Inter Display", system-ui, sans-serif'

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
