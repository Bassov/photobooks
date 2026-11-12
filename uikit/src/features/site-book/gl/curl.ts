/* The page turn in WebGL (Spec site-stand-v6 G / C, D28; port of the Designer's mockup-src.html renderer): the turning
   sheet is a 96 × 120 grid bent around the curl cylinder in the vertex shader, its back is paper with show-through, the
   sheet below is flat and takes the curl's shadow. One canvas over the stage (the sheet at org = (16, 24)), drawn through
   the page's shared renderer. Textures are bytes in = bytes out (no colour management), so at rest GL = the DOM sheet. */
import { ENDPAPER } from "../../site-demo-1/art"
import { SPREAD_R, type SiteBook } from "../../site-demo-1/data"
import type { Slide } from "../slides"
import { coverCanvas, ctx, cv, tex } from "./closed"
import { faceCanvas, type FaceLook } from "./open"
import { drawInto, type Any, type Three } from "./three"

/** the turn to draw: `top` curls at (xm, beta, r), `under` (null at rest) lies flat below it */
export type CurlFrame = { top: number; under: number | null; xm: number; beta: number; r: number }

const VS = `
uniform vec2 sheet; uniform vec2 org; uniform vec2 cvs; uniform float xm, beta, r, zc;
out vec2 vUv; out float vD;
void main(){
  vec2 p = vec2(uv.x, 1. - uv.y) * sheet; float c = cos(beta), s = sin(beta);
  float d = (p.x - xm) * c + (p.y - sheet.y * .5) * s; float z = 0.;
  if (d > 0.) { float PI = 3.14159265; float along, phi = min(d / r, PI);
    if (d < PI * r) { along = r * sin(phi); z = r * (1. - cos(phi)); } else { along = -(d - PI * r); z = 2. * r; }
    p -= vec2(c, s) * (d - along); }
  vec2 X = org + p; float k = zc / (zc - z);
  vec2 ndc = (X - cvs * .5) * k / (cvs * .5);
  gl_Position = vec4(ndc.x, -ndc.y, -z / 1000., 1.); vUv = uv; vD = d; }`
const FS = `
in vec2 vUv; in float vD; uniform sampler2D tex; uniform float r, crease; uniform vec3 back; uniform float through; out vec4 o;
void main(){
  float PI = 3.14159265, phi = clamp(vD / r, 0., PI); vec3 t = texture(tex, vUv).rgb;
  if (gl_FrontFacing) {
    float s = 1. - .30 * (1. - cos(phi));                                        // turns away from the light
    if (vD < 0.) s *= 1. - .10 * crease * clamp(1. + vD / r, 0., 1.);            // the valley in front of the roll
    o = vec4(t * s, 1.);
  } else {
    float s = .78 + .22 * (-cos(phi)) + .08 * exp(-pow((phi - 2.3) / .35, 2.));  // the back: lit roll, a soft highlight
    o = vec4(mix(back, t, through) * min(s, 1.04), 1.);        // paper back + show-through (pages .10, cover 0)
  } }`
const SVS = `
uniform vec2 sheet, org, cvs; out vec2 p;
void main(){ p = vec2(uv.x, 1. - uv.y) * sheet; vec2 X = org + p; vec2 ndc = (X - cvs * .5) / (cvs * .5); gl_Position = vec4(ndc.x, -ndc.y, .5, 1.); }`
const SFS = `
in vec2 p; uniform vec2 sheet; uniform float xm, beta, r, dsil; out vec4 o;
void main(){ float d = (p.x - xm) * cos(beta) + (p.y - sheet.y * .5) * sin(beta);
  float u = clamp((d - dsil) / (.8 * r + 16.), 0., 1.); float a = d < 0. ? 0. : .30 * (1. - u) * (1. - u);
  o = vec4(0., 0., 0., a); }`

/** the page back paper, rgb(.955 .952 .945); the cover's back is the endpaper */
const BACK = [0.955, 0.952, 0.945] as const
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
/** the sheet's top / bottom overhang in the canvas (the lifted curl grows toward the viewer) */
export const OV = 24

/** the DOM sheen (paper.ts SHEEN, `linear-gradient(100deg, rgb(255 255 255/.08), rgb(255 255 255/0) 40%)`) */
function sheen(c: HTMLCanvasElement) {
  const x = ctx(c), W = c.width, H = c.height, a = (100 * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a)
  const L = Math.abs(W * dx) + Math.abs(H * dy), g = x.createLinearGradient(W / 2 - (dx * L) / 2, H / 2 - (dy * L) / 2, W / 2 + (dx * L) / 2, H / 2 + (dy * L) / 2)
  g.addColorStop(0, "rgba(255,255,255,.08)"); g.addColorStop(0.4, "rgba(255,255,255,0)")
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  return c
}

/** a slide as one sheet texture (`look.pagePx` wide): the cover, the title page, a page, or a spread centred on paper;
   `fold` false (site-stand-v7 P2): a whole-spread slide has no gutter fold */
async function slideCanvas(b: SiteBook, s: Slide, look: FaceLook, paper: string, fold: boolean) {
  const PX = look.pagePx
  if (s.kind === "cover") return coverCanvas(b, PX, look.title)
  if (s.kind !== "spread") return sheen(await faceCanvas(b, look, s.kind === "title" ? { v: 1, side: 1 } : { v: s.k! + 1, side: s.side === "R" ? 1 : 0 }, paper))
  const half = { ...look, pagePx: Math.round(PX / 2) }
  const [l, r] = await Promise.all(([0, 1] as const).map((side) => faceCanvas(b, half, { v: s.k! + 1, side }, paper)))
  const PH = Math.round((PX * b.h) / b.w), c = cv(PX, PH), x = ctx(c), bh = PX / SPREAD_R[b.fmt], y = (PH - bh) / 2
  x.fillStyle = paper
  x.fillRect(0, 0, PX, PH)
  x.drawImage(l!, 0, y, PX / 2, bh)
  x.drawImage(r!, PX / 2, y, PX / 2, bh)
  if (!fold) return sheen(c)
  // the fold (art.tsx FOLD over 3 % of the spread)
  const f = x.createLinearGradient(PX * 0.485, 0, PX * 0.515, 0)
  f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(0.5, "rgba(0,0,0,.06)"); f.addColorStop(1, "rgba(0,0,0,0)")
  x.fillStyle = f
  x.fillRect(PX * 0.485, y, PX * 0.03, bh)
  return sheen(c)
}

export class PageCurl {
  /** a slide texture landed: draw again */
  onChange = () => {}
  private texs = new Map<number, Any | null>()
  private scene: Any; private cam: Any; private geo: Any
  private top: Any; private under: Any; private shadow: Any
  private dead = false

  constructor(private T: Three, private b: SiteBook, private slides: Slide[], private look: FaceLook, private paper: string, private pw: number, private ph: number, private fold = true) {
    const geo = (this.geo = new T.PlaneGeometry(1, 1, 96, 120))
    const base = () => ({ sheet: { value: new T.Vector2(pw, ph) }, org: { value: new T.Vector2(16, OV) }, cvs: { value: new T.Vector2(1, 1) }, xm: { value: pw }, beta: { value: 0 }, r: { value: 1 } })
    // all three in the transparent list, so renderOrder alone stacks them: under, its shadow, the turning sheet
    const sheetMat = () => new T.ShaderMaterial({
      glslVersion: T.GLSL3, vertexShader: VS, fragmentShader: FS, side: T.DoubleSide, transparent: true,
      uniforms: { ...base(), zc: { value: 1 }, tex: { value: null }, crease: { value: 0 }, back: { value: new T.Vector3(...BACK) }, through: { value: 0.1 } },
    })
    const mesh = (m: Any, order: number) => Object.assign(new T.Mesh(geo, m), { frustumCulled: false, renderOrder: order })
    this.under = mesh(Object.assign(sheetMat(), { depthTest: false, depthWrite: false }), -2)
    this.shadow = mesh(new T.ShaderMaterial({
      glslVersion: T.GLSL3, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { ...base(), dsil: { value: 0 } },
    }), -1)
    this.top = mesh(Object.assign(sheetMat(), { depthWrite: true }), 0)
    this.scene = new T.Scene()
    this.scene.add(this.under, this.shadow, this.top)
    this.cam = new T.Camera()
  }

  /** texture of slide i is in */
  ready(i: number) { return !!this.texs.get(i) }

  /** build slides si − 1 … si + 2, dispose the rest */
  keep(si: number) {
    for (const [i, t] of this.texs) if (i < si - 1 || i > si + 2) { t?.dispose(); this.texs.delete(i) }
    for (let i = Math.max(0, si - 1); i <= Math.min(this.slides.length - 1, si + 2); i++) {
      if (this.texs.has(i)) continue
      this.texs.set(i, null)
      void slideCanvas(this.b, this.slides[i]!, this.look, this.paper, this.fold).then((c) => {
        if (this.dead || this.texs.get(i) !== null) return
        const t = tex(this.T, c)
        t.colorSpace = this.T.NoColorSpace
        this.texs.set(i, t)
        this.onChange()
      }, () => {})
    }
  }

  /** draw the frame into `out` (backing = CSS size × k); false (nothing drawn) while a texture it needs is missing */
  draw(out: HTMLCanvasElement, k: number, f: CurlFrame) {
    const tt = this.texs.get(f.top), ut = f.under == null ? undefined : this.texs.get(f.under)
    if (!tt || (f.under != null && !ut)) return false
    const cw = out.width / k, ch = out.height / k, { pw, ph } = this, c = Math.cos(f.beta), s = Math.sin(f.beta)
    const dmax = Math.max(...[0, ph].map((y) => (pw - f.xm) * c + (y - ph / 2) * s))
    const phiMax = Math.min(dmax / f.r, Math.PI)
    const cover = this.slides[f.top]?.kind === "cover"
    const u = this.top.material.uniforms
    for (const m of [this.top, this.under, this.shadow]) {
      const v = m.material.uniforms
      v.cvs.value.set(cw, ch)
      v.r.value = f.r
    }
    u.xm.value = f.xm; u.beta.value = f.beta
    u.zc.value = ch / 2 / Math.tan((9 * Math.PI) / 180)
    u.crease.value = Math.max(0, Math.min(1, phiMax / (Math.PI / 2)))
    u.back.value.set(...(cover ? hex(ENDPAPER) : BACK))
    u.through.value = cover ? 0 : 0.1
    u.tex.value = tt
    const sv = this.shadow.material.uniforms
    sv.xm.value = f.xm; sv.beta.value = f.beta; sv.dsil.value = f.r * Math.sin(Math.max(0, Math.min(phiMax, Math.PI / 2)))
    this.shadow.visible = ut != null && dmax > 0
    this.under.visible = ut != null
    if (ut) {
      const v = this.under.material.uniforms
      v.xm.value = 1e5; v.tex.value = ut; v.zc.value = u.zc.value
    }
    drawInto(this.T, this.scene, this.cam, out)
    return true
  }

  dispose() {
    this.dead = true
    for (const t of this.texs.values()) t?.dispose()
    this.texs.clear()
    this.geo.dispose()
    for (const m of [this.top, this.under, this.shadow]) m.material.dispose()
  }
}
