/* The open book in WebGL (Spec site-stand-v2 R, D1, D2; port of the Designer's `gl.js` renderOpen). Units: cm. The book
   lies on y = 0 with the spine on x = 0 (head −z, tail +z); each page is an arc-length curve bent across its full width
   and the photo is its texture, so it bends and shades with the page. State = (a, θ): view a with the leaf between a
   and a + 1 at θ (0 … 180). The cover and the back board turn rigid; closed, the book slides to the centre. */
import { T as template } from "@/data"
import { ENDPAPER, LAST } from "../../site-demo-1/art"
import { AUTHOR, pagesOf, viewsOf, type SiteBook } from "../../site-demo-1/data"
import { BT, coverCanvas, ctx, cv, PAPER, photo, SQ, stripes, tex, thickCm, type TitleFont } from "./closed"
import type { Any, Three } from "./three"

const N = 72, BD = 0.3, FOV = 18, TILT = 12
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
/** rest profile of one page, direction angle along the arc: rises off the gutter, arches across the width, settles */
const aRest = (t: number) => 0.3 * (1 - t) ** 2 - 0.05 * t
/** the read fraction at view v: the read pages pile up on the left (reader.tsx readOf) */
export const readAt = (n: number, v: number) => clamp((v - 1) / (n - 3), 0, 1)

/** paper grain: luminance noise ±amp/2 per cell × cell texels (the page texture is ~2 texels per screen px: a 2-texel
   cell keeps the grain per screen pixel instead of averaging it away in the mipmaps) */
function grain(x: CanvasRenderingContext2D, w: number, h: number, amp: number, cell = 1) {
  const d = x.getImageData(0, 0, w, h), a = d.data, cw = Math.ceil(w / cell), row = new Float32Array(cw)
  for (let y = 0; y < h; y++) {
    if (y % cell === 0) for (let i = 0; i < cw; i++) row[i] = (Math.random() - 0.5) * amp
    for (let px = 0, i = y * w * 4; px < w; px++, i += 4) { const n = row[(px / cell) | 0]; a[i] += n; a[i + 1] += n; a[i + 2] += n }
  }
  x.putImageData(d, 0, 0)
}
function coverAt(x: CanvasRenderingContext2D, im: HTMLImageElement, X: number, Y: number, W: number, H: number) {
  const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), sw = W / k, sh = H / k
  x.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, X, Y, W, H)
}
function curve(W: number, y0: number, angle: (t: number) => number) {
  const p: [number, number][] = [[0, y0]]
  let x = 0, y = y0
  for (let i = 1; i <= N; i++) { const a = angle((i - 0.5) / N); x += (Math.cos(a) * W) / N; y += (Math.sin(a) * W) / N; p.push([x, y]) }
  return p
}

/** the page faces' look: fonts and colours read from the page (TitlePage), texture width per page */
export type OpenLook = { dark: boolean; board: string; bend: boolean } & FaceLook
export type FaceLook = { pagePx: number; title: TitleFont; body: string; ink: string; muted: string }
export type Face = { v: number; side: 0 | 1 }

/** the faces' fonts and colours as the page sets them: `el` carries the site's variables, `probe` the title class (`sd-it`) */
export function faceLook(el: HTMLElement, probe: HTMLElement | null): Omit<FaceLook, "pagePx"> {
  const cs = getComputedStyle(el), pc = getComputedStyle(probe ?? el)
  const num = (v: string, d: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d)
  const css = (p: string, d: string) => cs.getPropertyValue(p).trim() || d
  return {
    title: { family: pc.fontFamily, weight: pc.fontWeight, style: pc.fontStyle, variation: pc.fontVariationSettings, k: 0.14, ls: num(cs.getPropertyValue("--cover-ls"), -0.02) },
    body: cs.fontFamily, ink: css("--site-ink", "#2E2C2D"), muted: css("--site-muted", "#8A8580"),
  }
}

/** a page face as a canvas on `paper`: the spread's frames (LAST for the single last page), the title page or the
   endpaper, grain ±2.5 lum per 2-texel cell over paper and photos */
export async function faceCanvas(b: SiteBook, look: FaceLook, { v, side }: Face, paper: string) {
  const PW = look.pagePx, PH = Math.round((PW * b.h) / b.w), c = cv(PW, PH), x = ctx(c), k = v - 1
  const s = k >= 1 && k <= b.spreads.length ? b.spreads[k - 1] : null
  const endpaper = v === 1 ? side === 0 : !s || (side === 1 && s.template === "last")
  x.fillStyle = endpaper ? ENDPAPER : paper
  x.fillRect(0, 0, PW, PH)
  if (v === 1 && side === 1) {
    const f = look.title, fs = PH * 0.055, fs2 = Math.max((12 * PH) / 600, PH * 0.018), gap = PH * 0.025
    const font = `${f.style} ${f.weight} ${fs}px ${f.family}`, font2 = `400 ${fs2}px ${look.body}`
    await Promise.all([document.fonts.load(font, b.title), document.fonts.load(font2, AUTHOR)]).catch(() => [])
    const top = (PH - fs - gap - fs2) / 2
    x.textAlign = "center"; x.textBaseline = "top"
    x.font = font; x.fillStyle = look.ink
    if ("letterSpacing" in x) x.letterSpacing = `${f.ls * fs}px`
    x.fillText(b.title, PW / 2, top)
    x.font = font2; x.fillStyle = look.muted
    if ("letterSpacing" in x) x.letterSpacing = `${0.2 * fs2}px`
    x.fillText(`${AUTHOR.toUpperCase()} · ${b.year}`, PW / 2, top + fs + gap)
  } else if (s && !endpaper) {
    const frames = s.template === "last" ? [LAST] : template(s.template).frames
    const ims = await Promise.all(frames.map((_, i) => (s.photos[i] ? photo(s.photos[i]).catch(() => null) : null)))
    frames.forEach((f, i) => {
      const im = ims[i]
      if (im) coverAt(x, im, (f.x / 100) * 2 * PW - side * PW, (f.y / 100) * PH, (f.w / 100) * 2 * PW, (f.h / 100) * PH)
    })
  }
  grain(x, PW, PH, 5, 2)
  return c
}
type Mats = { front: Any; back: Any; tex: Any }

export class OpenBook {
  scene: Any; cam: Any
  /** a page texture landed: draw again */
  onChange = () => {}
  private book: Any; private dyn: Any[] = []
  private mats = new Map<string, Mats | null>()
  private keep: Any[] = []
  private paper!: Mats; private bump: Any; private edgeU: Any; private edgeV: Any; private board: Any; private cover: Any; private endpaper: Any
  private dead = false
  readonly n: number; readonly W: number; readonly H: number; readonly block: number

  private constructor(private T: Three, readonly b: SiteBook, private look: OpenLook) {
    this.n = viewsOf(b); this.W = b.w; this.H = b.h
    this.block = thickCm(b, 1e9) - 2 * BT
  }

  static async create(T: Three, b: SiteBook, look: OpenLook) {
    const o = new OpenBook(T, b, look)
    await o.build()
    return o
  }

  private k<V>(v: V): V { this.keep.push(v); return v }

  private async build() {
    const T = this.T, b = this.b, d = this.look.dark, scene = new T.Scene(), n = pagesOf(b) / 2
    const bc = cv(256, 256), bx = ctx(bc)
    bx.fillStyle = "#808080"; bx.fillRect(0, 0, 256, 256); grain(bx, 256, 256, 90)
    this.bump = this.k(new T.CanvasTexture(bc))
    this.bump.wrapS = this.bump.wrapT = T.RepeatWrapping
    this.bump.repeat.set(6, 6)
    const blank = cv(64, 80), x = ctx(blank)
    x.fillStyle = PAPER; x.fillRect(0, 0, 64, 80)
    this.paper = this.pageMats(blank)
    this.edgeU = this.k(new T.MeshStandardMaterial({ map: this.k(stripes(T, n, true)), roughness: 0.9, side: T.DoubleSide }))
    this.edgeV = this.k(new T.MeshStandardMaterial({ map: this.k(stripes(T, n, false)), roughness: 0.9, side: T.DoubleSide }))
    this.board = this.k(new T.MeshStandardMaterial({ color: this.look.board, roughness: 0.55 }))
    this.endpaper = this.k(new T.MeshStandardMaterial({ color: ENDPAPER, roughness: 0.62, bumpMap: this.bump, bumpScale: 0.25 }))
    this.cover = this.k(new T.MeshStandardMaterial({ map: this.k(tex(T, await coverCanvas(b, 1024, this.look.title))), roughness: 0.45 }))
    // light: sky/ground, one key with a soft VSM shadow (the leaf shades the page under it), a shadow-only floor; the sky
    // is 1.9 (gl.js 1.75 leaves flat paper at lum 234, the Spec's paper check wants ≥ 236)
    scene.add(new T.HemisphereLight(0xffffff, d ? 0x222220 : 0xd8d1c4, d ? 1.2 : 1.9))
    const key = new T.DirectionalLight(0xffffff, d ? 1.6 : 1.4)
    key.position.set(-12, 50, 55)
    key.castShadow = true
    key.shadow.mapSize.set(256, 256)
    key.shadow.radius = 4
    key.shadow.blurSamples = 24
    key.shadow.bias = -0.0004
    Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 })
    scene.add(key)
    const floor = new T.Mesh(this.k(new T.PlaneGeometry(400, 400)), this.k(new T.ShadowMaterial({ opacity: d ? 0.5 : 0.22 })))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    this.book = new T.Group()
    scene.add(this.book)
    this.scene = scene
    this.cam = new T.PerspectiveCamera(FOV, 1, 1, 2000)
  }

  private pageMats(c: HTMLCanvasElement): Mats {
    const T = this.T, t = tex(T, c), p = { map: t, roughness: 0.62, bumpMap: this.bump, bumpScale: 0.25 }
    return { tex: t, front: new T.MeshStandardMaterial({ ...p, side: T.FrontSide }), back: new T.MeshStandardMaterial({ ...p, side: T.BackSide }) }
  }

  private face(f: Face) {
    return faceCanvas(this.b, this.look, f, PAPER)
  }

  /** the materials of a face; the paper placeholder until its canvas lands */
  private mat(f: Face): Mats {
    const key = `${f.v}:${f.side}`, m = this.mats.get(key)
    if (m) return m
    if (m === undefined) {
      this.mats.set(key, null)
      void this.face(f).then((c) => {
        if (this.dead || !this.mats.has(key)) return
        this.mats.set(key, this.pageMats(c))
        this.onChange()
      }, () => {})
    }
    return this.paper
  }
  /** a face canvas is still on its way (the paper placeholder shows) */
  get loading() {
    for (const m of this.mats.values()) if (m === null) return true
    return false
  }
  /** keep textures for the previous, current and next spread only */
  private prune(a: number) {
    for (const [key, m] of this.mats) {
      const v = Number(key.split(":")[0])
      if (v >= a - 1 && v <= a + 2) continue
      if (m) { m.tex.dispose(); m.front.dispose(); m.back.dispose() }
      this.mats.delete(key)
    }
    for (let v = Math.max(1, a - 1); v <= Math.min(this.n - 2, a + 2); v++) { this.mat({ v, side: 0 }); this.mat({ v, side: 1 }) }
  }

  private geo(pos: number[], uv: number[], idx: number[]) {
    const g = new this.T.BufferGeometry()
    g.setAttribute("position", new this.T.Float32BufferAttribute(pos, 3))
    g.setAttribute("uv", new this.T.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  /** a page surface over the curve, extruded over H; u along the arc (`uOf`), v 0 at the tail */
  private sheet(pts: [number, number][], uOf: (t: number) => number, sign: number) {
    const H = this.H, pos: number[] = [], uv: number[] = [], idx: number[] = []
    pts.forEach(([x, y], i) => { for (const j of [0, 1]) { pos.push(sign * x, y, j ? H / 2 : -H / 2); uv.push(uOf(i / N), j ? 0 : 1) } })
    for (let i = 0; i < N; i++) { const a = 2 * i, b = a + 1, c = a + 2, d = a + 3; if (sign > 0) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b) }
    return this.geo(pos, uv, idx)
  }
  private add(g: Any, m: Any, cast = true) {
    const mesh = new this.T.Mesh(g, m)
    mesh.castShadow = cast
    mesh.receiveShadow = true
    this.book.add(mesh)
    this.dyn.push(g)
    return mesh
  }

  /** one side's page stack: the top page (stack height hs, arch × o), the splayed fore-edge, the tail face */
  private side(sign: number, hs: number, f: Face, o: number) {
    const W = this.W, H = this.H, y0 = BD + 0.08
    const ang = (t: number) => o * aRest(t) + (t < 0.12 ? Math.atan(hs / (0.12 * W)) : 0)
    const pts = curve(W - 0.2, y0, ang)
    this.add(this.sheet(pts, sign > 0 ? (t) => t : (t) => 1 - t, sign), this.mat(f).front)
    // fore-edge: from the top page edge down to the board, splayed out by 0.5 × the stack height so it faces up
    const [xe, ye] = pts[N], sp = (ye - BD) * 0.5
    this.add(this.geo([sign * xe, ye, -H / 2, sign * xe, ye, H / 2, sign * (xe + sp), BD, -H / 2, sign * (xe + sp), BD, H / 2], [0, 1, 0, 0, 1, 1, 1, 0], [0, 1, 2, 2, 1, 3]), this.edgeU, false)
    // tail face (toward the viewer): the leaves' lines follow the arch
    const tp: number[] = [], tu: number[] = [], ti: number[] = []
    pts.forEach(([x, y], i) => { tp.push(sign * x, y, H / 2, sign * (x + sp * (i / N) ** 10), BD, H / 2); tu.push(i / N, 0, i / N, 1) })
    for (let i = 0; i < N; i++) { const a = 2 * i; ti.push(a, a + 1, a + 2, a + 2, a + 1, a + 3) }
    this.add(this.geo(tp, tu, ti), this.edgeV, false)
    return { pts, y0, ang, top: Math.max(...pts.map((p) => p[1])) }
  }

  /** a board half, or the rigid cover / back board turning about the spine at height py */
  private boardBox(mats: Any, x: number, py = 0, th = 0) {
    const T = this.T, Wb = this.W + SQ + 0.3, g = new T.BoxGeometry(Wb, BD, this.H + 2 * SQ), m = new T.Mesh(g, mats)
    m.castShadow = m.receiveShadow = true
    m.position.set(x === 0 ? Wb / 2 : x * Wb / 2, BD / 2, 0)
    this.dyn.push(g)
    const piv = new T.Group()
    piv.position.y = py
    piv.rotation.z = (th * Math.PI) / 180
    piv.add(m)
    this.book.add(piv)
  }

  /** build the book at view a with the leaf at θ (deg) toward a + 1 */
  set(a: number, th: number) {
    for (const g of this.dyn) g.dispose()
    this.dyn = []
    this.book.clear()
    const n = this.n, f = th / 180, W = this.W, block = this.block
    const opening = a === 0, closing = a === n - 2 && th > 0
    const r = readAt(n, a) + (readAt(n, a + 1) - readAt(n, a)) * f
    this.prune(a)
    this.book.position.x = opening ? (-W / 2) * (1 - f) : closing ? (W / 2) * f : 0
    const e = this.board
    if (!opening) this.boardBox(e, -1)
    if (!closing) this.boardBox(e, 1)
    const L = opening ? null : this.side(-1, block * r, { v: a, side: 0 }, closing ? 1 - f : 1)
    const R = closing ? null : this.side(1, block * (1 - r), { v: th > 0 ? a + 1 : a, side: 1 }, opening ? f : 1)
    if (opening && R) this.boardBox([e, e, this.cover, this.endpaper, e, e], 0, R.top + 0.02 + (BD - R.top - 0.02) * f, th)
    else if (closing && L) this.boardBox([e, e, this.endpaper, e, e, e], 0, (L.top + BD) * f, th)
    else if (th > 0 && R) {
      const s = Math.sin((th * Math.PI) / 180), bend = this.look.bend ? 0.95 : 0
      const ang = (t: number) => (1 - f) * R.ang(t) + f * (Math.PI - R.ang(t)) - bend * s * t ** 1.4
      const pts = curve(W - 0.2, R.y0 + 0.02, ang)
      this.add(this.sheet(pts, (t) => t, 1), this.mat({ v: a, side: 1 }).front)
      this.add(this.sheet(pts, (t) => 1 - t, 1), this.mat({ v: a + 1, side: 0 }).back)
    }
    if (L && R) this.gutter()
  }

  /** a soft dark band where the pages dive into the binding */
  private gutterMat?: Any
  private gutter() {
    const T = this.T
    if (!this.gutterMat) {
      const c = cv(256, 4), x = ctx(c), g = x.createLinearGradient(0, 0, 256, 0)
      for (const [o, a] of [[0, 0], [0.35, 0.05], [0.47, 0.22], [0.5, 0.3], [0.53, 0.22], [0.65, 0.05], [1, 0]]) g.addColorStop(o, `rgba(0,0,0,${a})`)
      x.fillStyle = g; x.fillRect(0, 0, 256, 4)
      this.gutterMat = this.k(new T.MeshBasicMaterial({ map: this.k(new T.CanvasTexture(c)), transparent: true, depthWrite: false }))
    }
    const g = new T.PlaneGeometry(this.W * 0.16, this.H), m = new T.Mesh(g, this.gutterMat)
    m.rotation.x = -Math.PI / 2
    m.position.y = BD + 0.45
    this.dyn.push(g)
    this.book.add(m)
  }

  /** the camera: fov 18, 12° off vertical toward the tail, s px per cm at the book, looking at (0, .6, 0) from the centre
     of a W×H css-px view; `box` = the canvas within that view (the phone pans it over one page) */
  frame(W: number, H: number, s: number, box: { x: number; y: number; w: number; h: number }) {
    const rad = Math.PI / 180, D = H / (2 * s * Math.tan((FOV * rad) / 2)), e = TILT * rad, cam = this.cam
    cam.fov = FOV
    cam.aspect = W / H
    cam.position.set(0, D * Math.cos(e), D * Math.sin(e))
    cam.lookAt(0, 0.6, 0)
    cam.near = Math.max(1, D - 120)
    cam.far = D + 120
    cam.setViewOffset(W, H, box.x, box.y, box.w, box.h)
    cam.updateProjectionMatrix()
  }

  dispose() {
    this.dead = true
    for (const g of this.dyn) g.dispose()
    for (const m of [...this.mats.values(), this.paper]) if (m) { m.tex.dispose(); m.front.dispose(); m.back.dispose() }
    for (const d of this.keep) d.dispose?.()
    this.mats.clear()
  }
}
