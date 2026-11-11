/*
 * The open book in WebGL (Designer D44; port of the kit's
 * `site-book/gl/open.ts`). Units: cm. The book lies on y = 0 with the spine on
 * x = 0 (head −z, tail +z); each page is an arc-length curve bent across its
 * full width and the face is its texture, so it bends and shades with the
 * page. State = (a, θ): view a with the leaf between a and a + 1 at θ
 * (0 … 180). The cover and the back board turn rigid; closed, the book slides
 * to the centre.
 */
import { ctx, cv, grain } from './canvas'
import { BT, coverCanvas, SQ, stripes, tex } from './closed'
import type { Three } from './three'
import {
  facesOf,
  pageOfFace,
  thickCm,
  viewsOf,
  type Face,
  type GlBook,
} from './types'
import type {
  BufferGeometry,
  CanvasTexture,
  Group,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
} from './vendor/three.module.min.js'

/** arc segments per page, board thickness, fov, camera tilt off vertical */
const N = 72
const BD = 0.3
const FOV = 18
const TILT = 12
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
/** rest profile of one page, direction angle along the arc: rises off the gutter, arches across the width, settles */
const aRest = (t: number) => 0.3 * (1 - t) ** 2 - 0.05 * t
/** the read fraction at view v of n views: the read pages pile up on the left */
export const readAt = (n: number, v: number): number =>
  clamp((v - 1) / (n - 3), 0, 1)

type Pt = [number, number]
/** the page profile: N + 1 points over arc length W from (0, y0), direction `angle(t)` */
export function curve(
  W: number,
  y0: number,
  angle: (t: number) => number,
): Pt[] {
  const p: Pt[] = [[0, y0]]
  let x = 0
  let y = y0
  for (let i = 1; i <= N; i++) {
    const a = angle((i - 0.5) / N)
    x += (Math.cos(a) * W) / N
    y += (Math.sin(a) * W) / N
    p.push([x, y])
  }
  return p
}

export interface OpenLook {
  dark: boolean
  /** the turning leaf bends (the desktop reader) */
  bend: boolean
  /** endpaper face texture width */
  pagePx: number
}

/** top = the front pushed back in depth (polygon offset) for the stack tops, so a leaf landing on them always wins */
interface Mats {
  front: MeshStandardMaterial
  back: MeshStandardMaterial
  top: MeshStandardMaterial
  tex: CanvasTexture
}
const disposeMats = (m: Mats) => {
  m.tex.dispose()
  m.front.dispose()
  m.back.dispose()
  m.top.dispose()
}

interface Side {
  pts: Pt[]
  y0: number
  ang: (t: number) => number
  top: number
}

export class OpenBook {
  readonly scene: Scene
  readonly cam: PerspectiveCamera
  /** a page texture landed: draw again */
  onChange: () => void = () => undefined
  readonly n: number
  readonly W: number
  readonly H: number
  readonly block: number
  private readonly book: Group
  private dyn: BufferGeometry[] = []
  private readonly mats = new Map<string, Mats | null>()
  private readonly keep: { dispose(): void }[] = []
  private readonly bump: CanvasTexture
  private readonly paper: Mats
  private readonly edgeU: MeshStandardMaterial
  private readonly edgeV: MeshStandardMaterial
  private readonly board: MeshStandardMaterial
  private readonly cover: MeshStandardMaterial
  private readonly endpaper: MeshStandardMaterial
  private gutterMat: MeshBasicMaterial | undefined
  private dead = false

  constructor(
    private readonly T: Three,
    readonly b: GlBook,
    private readonly look: OpenLook,
  ) {
    this.n = viewsOf(b)
    this.W = b.w
    this.H = b.h
    this.block = thickCm(b, 1e9) - 2 * BT
    const d = look.dark
    const scene = new T.Scene()
    const leaves = facesOf(b) / 2
    const bc = cv(256, 256)
    const bx = ctx(bc)
    bx.fillStyle = '#808080'
    bx.fillRect(0, 0, 256, 256)
    grain(bx, 256, 256, 90)
    this.bump = this.k(new T.CanvasTexture(bc))
    this.bump.wrapS = this.bump.wrapT = T.RepeatWrapping
    this.bump.repeat.set(6, 6)
    const blank = cv(64, 80)
    const x = ctx(blank)
    x.fillStyle = b.paper
    x.fillRect(0, 0, 64, 80)
    this.paper = this.pageMats(blank)
    this.edgeU = this.k(
      new T.MeshStandardMaterial({
        map: this.k(stripes(T, leaves, true)),
        roughness: 0.9,
        side: T.DoubleSide,
      }),
    )
    this.edgeV = this.k(
      new T.MeshStandardMaterial({
        map: this.k(stripes(T, leaves, false)),
        roughness: 0.9,
        side: T.DoubleSide,
      }),
    )
    this.board = this.k(
      new T.MeshStandardMaterial({ color: b.cloth, roughness: 0.55 }),
    )
    this.endpaper = this.k(
      new T.MeshStandardMaterial({
        color: b.endpaper,
        roughness: 0.62,
        bumpMap: this.bump,
        bumpScale: 0.25,
      }),
    )
    this.cover = this.k(
      new T.MeshStandardMaterial({
        map: this.k(tex(T, coverCanvas(b, 1024))),
        roughness: 0.45,
      }),
    )
    // light: sky/ground, one key with a soft VSM shadow (the leaf shades the page under it), a shadow-only floor; the sky
    // is 1.9 (1.75 leaves flat paper at lum 234, the paper check wants ≥ 236)
    scene.add(
      new T.HemisphereLight(0xffffff, d ? 0x222220 : 0xd8d1c4, d ? 1.2 : 1.9),
    )
    const key = new T.DirectionalLight(0xffffff, d ? 1.6 : 1.4)
    key.position.set(-12, 50, 55)
    key.castShadow = true
    key.shadow.mapSize.set(256, 256)
    key.shadow.radius = 4
    key.shadow.blurSamples = 24
    key.shadow.bias = -0.0004
    Object.assign(key.shadow.camera, {
      left: -45,
      right: 45,
      top: 45,
      bottom: -45,
      near: 1,
      far: 200,
    })
    scene.add(key)
    const floor = new T.Mesh(
      this.k(new T.PlaneGeometry(400, 400)),
      this.k(new T.ShadowMaterial({ opacity: d ? 0.5 : 0.22 })),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    this.book = new T.Group()
    scene.add(this.book)
    this.scene = scene
    this.cam = new T.PerspectiveCamera(FOV, 1, 1, 2000)
  }

  private k<V extends { dispose(): void }>(v: V): V {
    this.keep.push(v)
    return v
  }

  private pageMats(c: CanvasImageSource): Mats {
    const T = this.T
    const t = tex(T, c)
    const p = { map: t, roughness: 0.62, bumpMap: this.bump, bumpScale: 0.25 }
    const top = new T.MeshStandardMaterial({
      ...p,
      side: T.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 4,
    })
    return {
      tex: t,
      front: new T.MeshStandardMaterial({ ...p, side: T.FrontSide }),
      back: new T.MeshStandardMaterial({ ...p, side: T.BackSide }),
      top,
    }
  }

  /** a face: the printed page from the input, or the endpaper with grain ±2.5 lum per 2-texel cell */
  private face(f: Face): Promise<CanvasImageSource> {
    const page = pageOfFace(this.b, f)
    if (page !== null) return this.b.face(page)
    const PW = this.look.pagePx
    const PH = Math.round((PW * this.b.h) / this.b.w)
    const c = cv(PW, PH)
    const x = ctx(c)
    x.fillStyle = this.b.endpaper
    x.fillRect(0, 0, PW, PH)
    grain(x, PW, PH, 5, 2)
    return Promise.resolve(c)
  }

  /** the materials of a face; the paper placeholder until its face lands */
  private mat(f: Face): Mats {
    const key = `${String(f.v)}:${String(f.side)}`
    const m = this.mats.get(key)
    if (m) return m
    if (m === undefined) {
      this.mats.set(key, null)
      this.face(f).then(
        (c) => {
          if (this.dead || !this.mats.has(key)) return
          this.mats.set(key, this.pageMats(c))
          this.onChange()
        },
        () => undefined,
      )
    }
    return this.paper
  }

  /** a face is still on its way (the paper placeholder shows) */
  get loading(): boolean {
    for (const m of this.mats.values()) if (m === null) return true
    return false
  }

  /** keep textures for the previous, current and next spread only */
  private prune(a: number) {
    for (const [key, m] of this.mats) {
      const v = Number(key.split(':')[0])
      if (v >= a - 1 && v <= a + 2) continue
      if (m) disposeMats(m)
      this.mats.delete(key)
    }
    for (let v = Math.max(1, a - 1); v <= Math.min(this.n - 2, a + 2); v++) {
      this.mat({ v, side: 0 })
      this.mat({ v, side: 1 })
    }
  }

  private geo(pos: number[], uv: number[], idx: number[]) {
    const g = new this.T.BufferGeometry()
    g.setAttribute('position', new this.T.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new this.T.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }

  /** a page surface over the curve, extruded over H; u along the arc (`uOf`), v 0 at the tail */
  private sheet(pts: Pt[], uOf: (t: number) => number, sign: number) {
    const H = this.H
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    pts.forEach(([x, y], i) => {
      for (const j of [0, 1]) {
        pos.push(sign * x, y, j ? H / 2 : -H / 2)
        uv.push(uOf(i / N), j ? 0 : 1)
      }
    })
    for (let i = 0; i < N; i++) {
      const a = 2 * i
      const b = a + 1
      const c = a + 2
      const d = a + 3
      if (sign > 0) idx.push(a, b, c, c, b, d)
      else idx.push(a, c, b, c, d, b)
    }
    return this.geo(pos, uv, idx)
  }

  private add(g: BufferGeometry, m: Material, cast = true) {
    const mesh = new this.T.Mesh(g, m)
    mesh.castShadow = cast
    mesh.receiveShadow = true
    this.book.add(mesh)
    this.dyn.push(g)
    return mesh
  }

  /** one side's page stack: the top page (stack height hs, arch × o), the splayed fore-edge, the tail face */
  private side(sign: number, hs: number, f: Face, o: number): Side {
    const W = this.W
    const H = this.H
    const y0 = BD + 0.08
    const ang = (t: number) =>
      o * aRest(t) + (t < 0.12 ? Math.atan(hs / (0.12 * W)) : 0)
    const pts = curve(W - 0.2, y0, ang)
    this.add(
      this.sheet(pts, sign > 0 ? (t) => t : (t) => 1 - t, sign),
      this.mat(f).top,
    )
    // fore-edge: from the top page edge down to the board, splayed out by 0.5 × the stack height so it faces up
    const [xe, ye] = pts[N] ?? [0, 0]
    const sp = (ye - BD) * 0.5
    this.add(
      this.geo(
        [
          ...[sign * xe, ye, -H / 2, sign * xe, ye, H / 2],
          ...[sign * (xe + sp), BD, -H / 2, sign * (xe + sp), BD, H / 2],
        ],
        [0, 1, 0, 0, 1, 1, 1, 0],
        [0, 1, 2, 2, 1, 3],
      ),
      this.edgeU,
      false,
    )
    // tail face (toward the viewer): the leaves' lines follow the arch
    const tp: number[] = []
    const tu: number[] = []
    const ti: number[] = []
    pts.forEach(([x, y], i) => {
      tp.push(sign * x, y, H / 2, sign * (x + sp * (i / N) ** 10), BD, H / 2)
      tu.push(i / N, 0, i / N, 1)
    })
    for (let i = 0; i < N; i++) {
      const a = 2 * i
      ti.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
    }
    this.add(this.geo(tp, tu, ti), this.edgeV, false)
    return { pts, y0, ang, top: Math.max(...pts.map((p) => p[1])) }
  }

  /** a board half, or the rigid cover / back board turning about the spine at height py */
  private boardBox(mats: Material | Material[], x: number, py = 0, th = 0) {
    const T = this.T
    const Wb = this.W + SQ + 0.3
    const g = new T.BoxGeometry(Wb, BD, this.H + 2 * SQ)
    const m = new T.Mesh(g, mats)
    m.castShadow = m.receiveShadow = true
    m.position.set(x === 0 ? Wb / 2 : (x * Wb) / 2, BD / 2, 0)
    this.dyn.push(g)
    const piv = new T.Group()
    piv.position.y = py
    piv.rotation.z = (th * Math.PI) / 180
    piv.add(m)
    this.book.add(piv)
  }

  /** build the book at view a with the leaf at θ (deg) toward a + 1 */
  set(a: number, th: number): void {
    for (const g of this.dyn) g.dispose()
    this.dyn = []
    this.book.clear()
    const n = this.n
    const f = th / 180
    const W = this.W
    const block = this.block
    const opening = a === 0
    const closing = a === n - 2 && th > 0
    // an interior turn draws the stacks without the leaf (left = read pages of a, right = unread of a + 1); the leaf
    // rides 0.02 above both, so the old view never wins the depth test as it lands
    const turning = !opening && !closing && th > 0 && th < 180
    const r = readAt(n, a) + (readAt(n, a + 1) - readAt(n, a)) * f
    const rl = turning ? readAt(n, a) : r
    const rr = turning ? readAt(n, a + 1) : r
    this.prune(a)
    this.book.position.x = opening
      ? (-W / 2) * (1 - f)
      : closing
        ? (W / 2) * f
        : 0
    const e = this.board
    if (!opening) this.boardBox(e, -1)
    if (!closing) this.boardBox(e, 1)
    const L = opening
      ? null
      : this.side(-1, block * rl, { v: a, side: 0 }, closing ? 1 - f : 1)
    const R = closing
      ? null
      : this.side(
          1,
          block * (1 - rr),
          { v: th > 0 ? a + 1 : a, side: 1 },
          opening ? f : 1,
        )
    if (opening && R) {
      this.boardBox(
        [e, e, this.cover, this.endpaper, e, e],
        0,
        R.top + 0.02 + (BD - R.top - 0.02) * f,
        th,
      )
    } else if (closing && L) {
      this.boardBox([e, e, this.endpaper, e, e, e], 0, (L.top + BD) * f, th)
    } else if (th > 0 && R) {
      const s = Math.sin((th * Math.PI) / 180)
      const bend = this.look.bend ? 0.95 : 0
      const D = L ?? R
      const ang = (t: number) =>
        (1 - f) * R.ang(t) + f * (Math.PI - D.ang(t)) - bend * s * t ** 1.4
      const pts = curve(W - 0.2, (1 - f) * R.y0 + f * D.y0 + 0.02, ang)
      this.add(
        this.sheet(pts, (t) => t, 1),
        this.mat({ v: a, side: 1 }).front,
      )
      this.add(
        this.sheet(pts, (t) => 1 - t, 1),
        this.mat({ v: a + 1, side: 0 }).back,
      )
    }
    if (L && R) this.gutter()
  }

  /** a soft dark band where the pages dive into the binding */
  private gutter() {
    const T = this.T
    if (!this.gutterMat) {
      const c = cv(256, 4)
      const x = ctx(c)
      const g = x.createLinearGradient(0, 0, 256, 0)
      const stops = [
        [0, 0],
        [0.35, 0.05],
        [0.47, 0.22],
        [0.5, 0.3],
        [0.53, 0.22],
        [0.65, 0.05],
        [1, 0],
      ] as const
      for (const [o, al] of stops)
        g.addColorStop(o, `rgba(0,0,0,${String(al)})`)
      x.fillStyle = g
      x.fillRect(0, 0, 256, 4)
      this.gutterMat = this.k(
        new T.MeshBasicMaterial({
          map: this.k(new T.CanvasTexture(c)),
          transparent: true,
          depthWrite: false,
        }),
      )
    }
    const g = new T.PlaneGeometry(this.W * 0.16, this.H)
    const m = new T.Mesh(g, this.gutterMat)
    m.rotation.x = -Math.PI / 2
    m.position.y = BD + 0.45
    this.dyn.push(g)
    this.book.add(m)
  }

  /**
   * The camera: fov 18, 12° off vertical toward the tail, s px per cm at the
   * book, looking at (0, .6, 0) from the centre of a W×H css-px view; `box` =
   * the canvas within that view (the phone pans it over one page).
   */
  frame(
    W: number,
    H: number,
    s: number,
    box: { x: number; y: number; w: number; h: number },
  ): void {
    const rad = Math.PI / 180
    const D = H / (2 * s * Math.tan((FOV * rad) / 2))
    const e = TILT * rad
    const cam = this.cam
    cam.fov = FOV
    cam.aspect = W / H
    cam.position.set(0, D * Math.cos(e), D * Math.sin(e))
    cam.lookAt(0, 0.6, 0)
    cam.near = Math.max(1, D - 120)
    cam.far = D + 120
    cam.setViewOffset(W, H, box.x, box.y, box.w, box.h)
    cam.updateProjectionMatrix()
  }

  dispose(): void {
    this.dead = true
    for (const g of this.dyn) g.dispose()
    for (const m of this.mats.values()) if (m) disposeMats(m)
    disposeMats(this.paper)
    for (const d of this.keep) d.dispose()
    this.mats.clear()
  }
}
