/*
 * The closed hardcover in WebGL (Designer D44; port of the kit's
 * `site-book/gl/closed.ts`). Units: cm. The book stands on y = 0, its bottom
 * centre at the origin; the camera is framed so the book centre lands on the
 * centre of the host's W×H box at `s` px per cm, like the CSS book.
 */
import { ctx, cv } from './canvas'
import { maxAnisotropy, type Three } from './three'
import { facesOf, thickCm, type GlBook } from './types'
import type {
  CanvasTexture,
  Group,
  Material,
  PerspectiveCamera,
  Scene,
} from './vendor/three.module.min.js'

/** board thickness and the board's square over the page block, cm */
export const BT = 0.25
export const SQ = 0.3

export interface GlPose {
  ry: number
  elev: number
  lift: number
  peek: number
  rz: number
}
export const REST: GlPose = { ry: 30, elev: 20, lift: 0, peek: 0, rz: 0 }
export const HOVER: GlPose = { ry: 14, elev: 16, lift: 8, peek: 22, rz: 0 }
export const ACTIVE: GlPose = { ry: 10, elev: 14, lift: 4, peek: 12, rz: 0 }
const FOV = 22

/** the canvas around the host box (fractions of W / H): the shadow falls right and back, the lift and the head go up */
export const OVER = { l: 0.15, r: 0.35, b: 0.12, t: 0.1 }

export function tex(
  T: Three,
  c: CanvasImageSource | OffscreenCanvas,
): CanvasTexture {
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = maxAnisotropy(T)
  t.generateMipmaps = true
  t.minFilter = T.LinearMipmapLinearFilter
  return t
}

/** page edges: one soft light/dark pair per leaf (lum 222–251, G −3, B −9, ±3 noise), varying along u (`alongU`) or v */
export function stripes(T: Three, n: number, alongU: boolean): CanvasTexture {
  const L = 512
  const c = alongU ? cv(L, 8) : cv(8, L)
  const x = ctx(c)
  for (let i = 0; i < L; i++) {
    const k = (i / L) * n
    const f = k - Math.floor(k)
    const v = 0.5 + 0.5 * Math.cos(f * 2 * Math.PI)
    const g = Math.round(222 + 29 * v + (Math.random() - 0.5) * 6)
    x.fillStyle = `rgb(${String(g)},${String(g - 3)},${String(g - 9)})`
    if (alongU) x.fillRect(i, 0, 1, 8)
    else x.fillRect(0, L - 1 - i, 8, 1)
  }
  return tex(T, c)
}

/** a cover panel on the cloth, `px` wide, trim aspect */
function panelCanvas(b: GlBook, panel: CanvasImageSource, px: number) {
  const W = px
  const H = Math.round((px * b.h) / b.w)
  const c = cv(W, H)
  const x = ctx(c)
  x.fillStyle = b.cloth
  x.fillRect(0, 0, W, H)
  x.drawImage(panel, 0, 0, W, H)
  return { c, x, W, H }
}

/** front cover: the front panel and the hinge shade over 5 %; `px` = canvas width */
export function coverCanvas(b: GlBook, px: number): HTMLCanvasElement {
  const { c, x, W, H } = panelCanvas(b, b.cover.front, px)
  const g = x.createLinearGradient(0, 0, W * 0.05, 0)
  g.addColorStop(0, 'rgba(0,0,0,.30)')
  g.addColorStop(0.45, 'rgba(0,0,0,.06)')
  g.addColorStop(0.7, 'rgba(255,255,255,.26)')
  g.addColorStop(1, 'rgba(0,0,0,.05)')
  x.fillStyle = g
  x.fillRect(0, 0, W * 0.05, H)
  return c
}

/** spine: the spine panel on the cloth, `px` high, as wide as the kit's spine texture */
function spineCanvas(b: GlBook, Tk: number, px: number) {
  const H = px
  const W = Math.max(8, Math.round(((128 * Tk) / 1.7) * (px / 1280)))
  const c = cv(W, H)
  const x = ctx(c)
  x.fillStyle = b.cloth
  x.fillRect(0, 0, W, H)
  x.drawImage(b.cover.spine, 0, 0, W, H)
  return c
}

const KEY_DIR = [-25, 80, 30] as const
const KEY_LEN = Math.hypot(...KEY_DIR)
const KEY = KEY_DIR.map((v) => v / KEY_LEN) as [number, number, number]

interface Shadow {
  c: HTMLCanvasElement
  t: CanvasTexture
  R: number
  S: number
}

export interface ClosedOptions {
  floor: boolean
  /** device px per css px of the drawn book (texture sizes) */
  k: number
}

/** one closed book: scene, camera and pose; `pose` frames it into a canvas of the host box + OVER */
export class ClosedBook {
  readonly scene: Scene
  readonly cam: PerspectiveCamera
  readonly shadow: Shadow | undefined
  private readonly piv: Group
  private readonly hinge: Group
  private disposables: { dispose(): void }[] = []

  constructor(
    private readonly T: Three,
    readonly b: GlBook,
    readonly s: number,
    o: ClosedOptions,
  ) {
    const W = b.w
    const H = b.h
    const Tk = thickCm(b, s)
    const scene = new T.Scene()
    // texture sizes follow the drawn size (cover ≤ 1024 wide, spine ≤ 1280 high) so 100 books stay cheap
    const coverPx = Math.min(1024, Math.ceil(W * s * o.k * 1.5))
    const spinePx = Math.min(1280, Math.ceil(H * s * o.k * 1.5))
    const keep = <V extends { dispose(): void }>(v: V): V => {
      this.disposables.push(v)
      return v
    }
    const std = (p: ConstructorParameters<Three['MeshStandardMaterial']>[0]) =>
      keep(new T.MeshStandardMaterial(p))
    const edge = std({ color: b.cloth, roughness: 0.55 })
    const cover = std({
      map: keep(tex(T, coverCanvas(b, coverPx))),
      roughness: 0.45,
    })
    const back = std({
      map: keep(tex(T, panelCanvas(b, b.cover.back, coverPx).c)),
      roughness: 0.45,
    })
    const endpaper = std({ color: b.endpaper, roughness: 0.7 })
    const paper = std({ color: b.paper, roughness: 0.9 })
    const box = (w: number, h: number, d: number) =>
      keep(new T.BoxGeometry(w, h, d))
    const book = new T.Group()
    // front board on a hinge at the spine (peek = rotation about the spine); face order +x −x +y −y +z −z
    this.hinge = new T.Group()
    this.hinge.position.set(0, 0, Tk / 2 - BT / 2)
    const frontMats: Material[] = [edge, edge, edge, edge, cover, endpaper]
    const front = new T.Mesh(box(W, H, BT), frontMats)
    front.position.set(W / 2, H / 2, 0)
    this.hinge.add(front)
    const backMats: Material[] = [edge, edge, edge, edge, endpaper, back]
    const backBoard = new T.Mesh(box(W, H, BT), backMats)
    backBoard.position.set(W / 2, H / 2, -Tk / 2 + BT / 2)
    const spineMap = keep(tex(T, spineCanvas(b, Tk, spinePx)))
    const spine = new T.Mesh(
      keep(
        new T.CylinderGeometry(
          Tk / 2,
          Tk / 2,
          H,
          48,
          1,
          true,
          Math.PI,
          Math.PI,
        ),
      ),
      std({ map: spineMap, roughness: 0.55, side: T.DoubleSide }),
    )
    spine.position.set(0, H / 2, 0)
    // page block: the leaves stack along z, so both the fore-edge (u → z) and the head (v → z) vary along the depth
    const pw = W - SQ - 0.1
    const ph = H - 2 * SQ
    const pd = Tk - 2 * BT
    const leaves = facesOf(b) / 2
    const fore = std({ map: keep(stripes(T, leaves, true)), roughness: 0.9 })
    const head = std({ map: keep(stripes(T, leaves, false)), roughness: 0.9 })
    const blockMats: Material[] = [fore, fore, head, head, paper, paper]
    const block = new T.Mesh(box(pw, ph, pd), blockMats)
    block.position.set(0.1 + pw / 2, H / 2, 0)
    book.add(this.hinge, backBoard, spine, block)
    book.position.x = -W / 2
    this.piv = new T.Group()
    this.piv.add(book)
    scene.add(this.piv)
    // light: sky/ground, the key from the upper left, a front fill; no shadow maps
    scene.add(new T.HemisphereLight(0xffffff, 0xd8d1c4, 1.35))
    const key = new T.DirectionalLight(0xffffff, 1.0)
    key.position.set(KEY[0] * 100, KEY[1] * 100, KEY[2] * 100)
    const fill = new T.DirectionalLight(0xffffff, 0.7)
    fill.position.set(10, 25, 90)
    scene.add(key, fill)
    if (o.floor) {
      const S = 8
      const R = Math.ceil(0.5 * Math.max(W, H) + 0.4 * H + 10)
      const c = cv(2 * R * S, 2 * R * S)
      const t = keep(new T.CanvasTexture(c))
      const m = new T.Mesh(
        keep(new T.PlaneGeometry(2 * R, 2 * R)),
        keep(
          new T.MeshBasicMaterial({
            map: t,
            transparent: true,
            depthWrite: false,
          }),
        ),
      )
      m.rotation.x = -Math.PI / 2
      m.position.y = 0.01
      m.renderOrder = -1
      scene.add(m)
      this.shadow = { c, t, R, S }
    }
    this.scene = scene
    this.cam = new T.PerspectiveCamera(FOV, 1, 1, 1000)
  }

  /** baked soft shadow: footprint ∪ the top projected along the key, blur 3 cm; contact = footprint blur .4 cm × (1 − lift/12) */
  private bake(p: GlPose) {
    if (!this.shadow) return
    const { c, t, R, S } = this.shadow
    const x = ctx(c)
    const b = this.b
    const Tk = thickCm(b, this.s)
    const m = this.piv.matrixWorld
    const v = new this.T.Vector3()
    const P = (lx: number, ly: number, lz: number): [number, number] => {
      v.set(lx, ly, lz).applyMatrix4(m)
      const k = v.y / KEY[1]
      return [(v.x - KEY[0] * k + R) * S, (v.z - KEY[2] * k + R) * S]
    }
    const lift = p.lift / this.s
    const xs = [-b.w / 2 - 0.5, b.w / 2] as const
    const zs = [-Tk / 2, Tk / 2] as const
    const ring = (y: number) => [
      P(xs[0], y, zs[0]),
      P(xs[1], y, zs[0]),
      P(xs[1], y, zs[1]),
      P(xs[0], y, zs[1]),
    ]
    // the footprint sits on the floor even when the book lifts: drop the lift before projecting
    const bot = ring(-lift)
    const top = ring(b.h)
    const poly = (pts: [number, number][]) => {
      x.beginPath()
      pts.forEach(([a, z], i) => {
        if (i) x.lineTo(a, z)
        else x.moveTo(a, z)
      })
      x.closePath()
      x.fill()
    }
    x.clearRect(0, 0, c.width, c.height)
    x.filter = `blur(${String(3 * S)}px)`
    x.fillStyle = 'rgba(0,0,0,0.26)'
    poly(bot)
    poly(top)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      poly([bot[i], bot[j], top[j], top[i]] as [number, number][])
    }
    const contact = Math.max(0, 1 - p.lift / 12)
    if (contact > 0) {
      x.filter = `blur(${String(0.4 * S)}px)`
      x.fillStyle = `rgba(0,0,0,${String(0.42 * contact)})`
      poly(bot)
    }
    x.filter = 'none'
    t.needsUpdate = true
  }

  /** pose the book and frame the camera for the host box drawn into a canvas of the box + OVER */
  pose(p: GlPose): void {
    const b = this.b
    const s = this.s
    const H = b.h
    const rad = Math.PI / 180
    this.piv.rotation.set(0, p.ry * rad, p.rz * rad, 'ZYX')
    this.piv.position.y = p.lift / s
    this.hinge.rotation.y = -p.peek * rad
    this.piv.updateMatrixWorld(true)
    this.bake(p)
    // eye: the kit's distance, `elev` above the book centre, looking at the centre
    const D = (H * 1.25) / Math.tan((FOV * rad) / 2) / 2 + 30
    const e = p.elev * rad
    const cam = this.cam
    cam.position.set(0, H / 2 + D * Math.sin(e), D * Math.cos(e))
    cam.up.set(0, 1, 0)
    cam.lookAt(0, H / 2, 0)
    // a full view centred on the book centre at s px/cm (at distance D), cropped to the canvas by a view offset
    const Wp = b.w * s
    const Hp = H * s
    const cx = OVER.l * Wp + Wp / 2
    const cy = OVER.t * Hp + Hp / 2
    const cw = Wp * (1 + OVER.l + OVER.r)
    const ch = Hp * (1 + OVER.t + OVER.b)
    const fw = 2 * Math.max(cx, cw - cx)
    const fh = 2 * Math.max(cy, ch - cy)
    cam.fov = (2 * Math.atan(fh / (2 * s * D))) / rad
    cam.aspect = fw / fh
    cam.near = Math.max(1, D - 3 * H)
    cam.far = D + 3 * H
    cam.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, cw, ch)
    cam.updateProjectionMatrix()
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.disposables = []
  }
}

/** the canvas box in css px, relative to the host's top-left */
export function canvasBox(
  b: Pick<GlBook, 'w' | 'h'>,
  s: number,
): { left: number; top: number; width: number; height: number } {
  const W = b.w * s
  const H = b.h * s
  return {
    left: -OVER.l * W,
    top: -OVER.t * H,
    width: W * (1 + OVER.l + OVER.r),
    height: H * (1 + OVER.t + OVER.b),
  }
}
