/*
 * The home's GL books (Designer personal-site P4, D38, D42): loaded lazily by
 * `Book3D` after `load` + idle, so the site entry never pulls `gl/` or three.
 * Site data → `GlBookInput` (`glCover`); each face-out is drawn once into a
 * canvas that replaces the CSS faces in place. Any failure keeps the CSS book.
 */
import type { SiteCatalogBook } from '../siteInput'
import { cv } from './gl/canvas'
import { canvasBox, ClosedBook, type GlPose } from './gl/closed'
import { drawInto, loadThree, type Three } from './gl/three'
import { glBook } from './gl/types'
import { FONT, glInput, photoOf } from './glCover'
import { glWanted } from './glWanted'

/** the kit's face-out pose (ry 0, rx 3.5) in GL terms: elev = 20 + (−rx − 14) · 0.8 */
export const FACE_OUT: GlPose = { ry: 0, elev: 6, lift: 0, peek: 0, rz: 0 }

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
