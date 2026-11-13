/* The closed hardcover in WebGL (Spec site-stand-v2 G; port of the Designer's `gl.js` closedBook / closedLights /
   bakedShadow). Units: cm. The book stands on y = 0, its bottom centre at the origin; the camera is framed so the book
   centre lands on the centre of the host's W×H box at `s` px per cm, like the CSS book did. */
import { ENDPAPER } from "../../site/art"
import { pagesOf, src, type SiteBook } from "../../site/sample"
import { maxAnisotropy, type Any, type Three } from "./three"

export const BT = 0.25, SQ = 0.3
export const PAPER = "#FBFAF7"
/** thickness in cm: book3d.tsx `thick()` (including its 12 px floor) */
export const thickCm = (b: SiteBook, s: number) => Math.max(0.6 + (pagesOf(b) / 2) * 0.1, 12 / s)

export type GlPose = { ry: number; elev: number; lift: number; peek: number; rz: number }
export const REST: GlPose = { ry: 30, elev: 20, lift: 0, peek: 0, rz: 0 }
export const HOVER: GlPose = { ry: 14, elev: 16, lift: 8, peek: 22, rz: 0 }
export const ACTIVE: GlPose = { ry: 10, elev: 14, lift: 4, peek: 12, rz: 0 }
const FOV = 22

/** the cover title as the page's CoverFace sets it (`.sd-it` + `--cover-k` / `--cover-ls`) */
export type TitleFont = { family: string; weight: string; style: string; k: number; ls: number; variation: string }

/** the canvas around the host box (fractions of W / H): the shadow falls right and back, the lift and the head go up */
export const OVER = { l: 0.15, r: 0.35, b: 0.12, t: 0.1 }

export const cv = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) })
export const ctx = (c: HTMLCanvasElement) => c.getContext("2d") as CanvasRenderingContext2D
export function photo(id: string) {
  const i = new Image()
  i.decoding = "async"
  i.src = src(id)
  return i.decode().then(() => i)
}
function coverDraw(x: CanvasRenderingContext2D, im: HTMLImageElement, W: number, H: number) {
  const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), sw = W / k, sh = H / k
  x.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H)
}
export function tex(T: Three, c: HTMLCanvasElement) {
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = maxAnisotropy(T)
  t.generateMipmaps = true
  t.minFilter = T.LinearMipmapLinearFilter
  return t
}

/** page edges: one soft light/dark pair per leaf (lum 222–251, G −3, B −9, ±3 noise), varying along u (`alongU`) or v */
export function stripes(T: Three, n: number, alongU: boolean) {
  const L = 512, c = alongU ? cv(L, 8) : cv(8, L), x = ctx(c)
  for (let i = 0; i < L; i++) {
    const k = (i / L) * n, f = k - Math.floor(k), v = 0.5 + 0.5 * Math.cos(f * 2 * Math.PI)
    const g = Math.round(222 + 29 * v + (Math.random() - 0.5) * 6)
    x.fillStyle = `rgb(${g},${g - 3},${g - 9})`
    if (alongU) x.fillRect(i, 0, 1, 8)
    else x.fillRect(0, L - 1 - i, 8, 1)
  }
  return tex(T, c)
}

/** cover: photo cover-crop, the hinge shade over 5 %, the title 9 % from the top or bottom; `px` = canvas width */
export async function coverCanvas(b: SiteBook, px: number, f: TitleFont) {
  const W = px, H = Math.round((px * b.h) / b.w), c = cv(W, H), x = ctx(c)
  x.fillStyle = b.spine
  x.fillRect(0, 0, W, H)
  try { coverDraw(x, await photo(b.cover), W, H) } catch { /* the board colour stays */ }
  const g = x.createLinearGradient(0, 0, W * 0.05, 0)
  g.addColorStop(0, "rgba(0,0,0,.30)"); g.addColorStop(0.45, "rgba(0,0,0,.06)"); g.addColorStop(0.7, "rgba(255,255,255,.26)"); g.addColorStop(1, "rgba(0,0,0,.05)")
  x.fillStyle = g
  x.fillRect(0, 0, W * 0.05, H)
  const fs = f.k * Math.min(W, H), font = `${f.style} ${f.weight} ${fs}px ${f.family}`
  await document.fonts.load(font, b.title).catch(() => [])
  x.font = font
  if ("letterSpacing" in x) x.letterSpacing = `${f.ls * fs}px`
  x.fillStyle = b.ink
  x.textAlign = "center"
  const bottom = b.place === "bottom"
  x.textBaseline = bottom ? "bottom" : "top"
  x.fillText(b.title, W / 2, bottom ? H * 0.91 : H * 0.09, W * 0.84)
  return c
}
/** spine: `b.spine` + the title in `b.spineInk`, reading top → bottom from 8 % */
function spineCanvas(b: SiteBook, Tk: number, px: number, f: TitleFont) {
  const H = px, W = Math.max(8, Math.round(((128 * Tk) / 1.7) * (px / 1280))), c = cv(W, H), x = ctx(c)
  x.fillStyle = b.spine
  x.fillRect(0, 0, W, H)
  x.save()
  x.translate(W / 2, H * 0.08)
  x.rotate(Math.PI / 2)
  x.font = `${f.style === "italic" ? "italic " : ""}500 ${Math.min(30 * (px / 1280), W * 0.42)}px ${f.family}`
  x.fillStyle = b.spineInk
  x.textBaseline = "middle"
  x.fillText(b.title, 0, 0)
  x.restore()
  return c
}

const KEY = [-25, 80, 30].map((v, _, a) => v / Math.hypot(...a))

/** one closed book: scene, camera and pose; `render` frames it into a canvas of the host box + OVER */
export class ClosedBook {
  scene: Any; cam: Any; piv: Any; hinge: Any; shadow?: { c: HTMLCanvasElement; t: Any; R: number; S: number }
  private disposables: Any[] = []
  private constructor(private T: Three, readonly b: SiteBook, readonly s: number) {}

  static async create(T: Three, b: SiteBook, s: number, o: { floor: boolean; font: TitleFont; k: number }) {
    const g = new ClosedBook(T, b, s)
    await g.build(o.font, o.k, o.floor)
    return g
  }

  private keep<V>(v: V): V { this.disposables.push(v); return v }

  private async build(font: TitleFont, k: number, floor: boolean) {
    const T = this.T, b = this.b, W = b.w, H = b.h, Tk = thickCm(b, this.s), scene = new T.Scene()
    // texture sizes follow the drawn size (cover ≤ 1024 wide, spine ≤ 1280 high) so 100 books stay cheap
    const coverPx = Math.min(1024, Math.ceil(W * this.s * k * 1.5)), spinePx = Math.min(1280, Math.ceil(H * this.s * k * 1.5))
    const std = (p: object) => this.keep(new T.MeshStandardMaterial(p))
    const edge = std({ color: b.spine, roughness: 0.55 })
    const cover = std({ map: this.keep(tex(T, await coverCanvas(b, coverPx, font))), roughness: 0.45 })
    const endpaper = std({ color: ENDPAPER, roughness: 0.7 })
    const paper = std({ color: PAPER, roughness: 0.9 })
    const box = (w: number, h: number, d: number) => this.keep(new T.BoxGeometry(w, h, d))
    const book = new T.Group()
    // front board on a hinge at the spine (peek = rotation about the spine); face order +x −x +y −y +z −z
    this.hinge = new T.Group()
    this.hinge.position.set(0, 0, Tk / 2 - BT / 2)
    const front = new T.Mesh(box(W, H, BT), [edge, edge, edge, edge, cover, endpaper])
    front.position.set(W / 2, H / 2, 0)
    this.hinge.add(front)
    const back = new T.Mesh(box(W, H, BT), [edge, edge, edge, edge, endpaper, edge])
    back.position.set(W / 2, H / 2, -Tk / 2 + BT / 2)
    const spineMap = this.keep(tex(T, spineCanvas(b, Tk, spinePx, font)))
    const spine = new T.Mesh(this.keep(new T.CylinderGeometry(Tk / 2, Tk / 2, H, 48, 1, true, Math.PI, Math.PI)), std({ map: spineMap, roughness: 0.55, side: T.DoubleSide }))
    spine.position.set(0, H / 2, 0)
    // page block: the leaves stack along z, so both the fore-edge (u → z) and the head (v → z) vary along the depth
    const pw = W - SQ - 0.1, ph = H - 2 * SQ, pd = Tk - 2 * BT, n = pagesOf(b) / 2
    const fore = std({ map: this.keep(stripes(T, n, true)), roughness: 0.9 }), head = std({ map: this.keep(stripes(T, n, false)), roughness: 0.9 })
    const block = new T.Mesh(box(pw, ph, pd), [fore, fore, head, head, paper, paper])
    block.position.set(0.1 + pw / 2, H / 2, 0)
    book.add(this.hinge, back, spine, block)
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
    if (floor) {
      const S = 8, R = Math.ceil(0.5 * Math.max(W, H) + 0.4 * H + 10), c = cv(2 * R * S, 2 * R * S), t = this.keep(new T.CanvasTexture(c))
      const m = new T.Mesh(this.keep(new T.PlaneGeometry(2 * R, 2 * R)), this.keep(new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })))
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
    const { c, t, R, S } = this.shadow, x = ctx(c), b = this.b, Tk = thickCm(b, this.s), m = this.piv.matrixWorld
    const v = new this.T.Vector3()
    const P = (lx: number, ly: number, lz: number): [number, number] => {
      v.set(lx, ly, lz).applyMatrix4(m)
      const k = v.y / KEY[1]
      return [(v.x - KEY[0] * k + R) * S, (v.z - KEY[2] * k + R) * S]
    }
    const lift = p.lift / this.s, xs = [-b.w / 2 - 0.5, b.w / 2], zs = [-Tk / 2, Tk / 2]
    const ring = (y: number) => [P(xs[0], y, zs[0]), P(xs[1], y, zs[0]), P(xs[1], y, zs[1]), P(xs[0], y, zs[1])]
    // the footprint sits on the floor even when the book lifts: drop the lift before projecting
    const bot = ring(-lift), top = ring(b.h)
    const poly = (pts: [number, number][]) => { x.beginPath(); pts.forEach(([a, z], i) => (i ? x.lineTo(a, z) : x.moveTo(a, z))); x.closePath(); x.fill() }
    x.clearRect(0, 0, c.width, c.height)
    x.filter = `blur(${3 * S}px)`
    x.fillStyle = "rgba(0,0,0,0.26)"
    poly(bot); poly(top)
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; poly([bot[i], bot[j], top[j], top[i]]) }
    const contact = Math.max(0, 1 - p.lift / 12)
    if (contact > 0) {
      x.filter = `blur(${0.4 * S}px)`
      x.fillStyle = `rgba(0,0,0,${0.42 * contact})`
      poly(bot)
    }
    x.filter = "none"
    t.needsUpdate = true
  }

  /** pose the book and frame the camera for a host box W×H (css px) drawn into a canvas of the box + OVER */
  pose(p: GlPose) {
    const b = this.b, s = this.s, H = b.h, rad = Math.PI / 180
    this.piv.rotation.set(0, p.ry * rad, p.rz * rad, "ZYX")
    this.piv.position.y = p.lift / s
    this.hinge.rotation.y = -p.peek * rad
    this.piv.updateMatrixWorld(true)
    this.bake(p)
    // eye: gl.js distance, `elev` above the book centre, looking at the centre
    const D = (H * 1.25) / Math.tan((FOV * rad) / 2) / 2 + 30, e = p.elev * rad, cam = this.cam
    cam.position.set(0, H / 2 + D * Math.sin(e), D * Math.cos(e))
    cam.up.set(0, 1, 0)
    cam.lookAt(0, H / 2, 0)
    // a full view centred on the book centre at s px/cm (at distance D), cropped to the canvas by a view offset
    const Wp = b.w * s, Hp = H * s, cx = OVER.l * Wp + Wp / 2, cy = OVER.t * Hp + Hp / 2
    const cw = Wp * (1 + OVER.l + OVER.r), ch = Hp * (1 + OVER.t + OVER.b)
    const fw = 2 * Math.max(cx, cw - cx), fh = 2 * Math.max(cy, ch - cy)
    cam.fov = (2 * Math.atan(fh / (2 * s * D))) / rad
    cam.aspect = fw / fh
    cam.near = Math.max(1, D - 3 * H)
    cam.far = D + 3 * H
    cam.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, cw, ch)
    cam.updateProjectionMatrix()
  }

  dispose() {
    for (const d of this.disposables) d.dispose?.()
    this.disposables = []
  }
}

/** the canvas box in css px, relative to the host's top-left */
export function canvasBox(b: SiteBook, s: number) {
  const W = b.w * s, H = b.h * s
  return { left: -OVER.l * W, top: -OVER.t * H, width: W * (1 + OVER.l + OVER.r), height: H * (1 + OVER.t + OVER.b) }
}
