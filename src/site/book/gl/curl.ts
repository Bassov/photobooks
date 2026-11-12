/*
 * The page turn in WebGL (Designer D44; port of the kit's
 * `site-book/gl/curl.ts`): the turning sheet is a 96 × 120 grid bent around
 * the curl cylinder in the vertex shader, its back is paper with
 * show-through, the sheet below is flat and takes the curl's shadow. One
 * canvas over the stage (the sheet at org = (16, 24)), drawn through the
 * page's shared renderer. Textures are bytes in = bytes out (no colour
 * management), so at rest GL = the DOM sheet.
 */
import { ctx, cv } from './canvas'
import { coverCanvas, tex } from './closed'
import { drawInto, type Three } from './three'
import type { GlBook } from './types'
import type {
  Camera,
  CanvasTexture,
  IUniform,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from './vendor/three.module.min.js'

/** the turn to draw: `top` curls at (xm, beta, r), `under` (null at rest) lies flat below it */
export interface CurlFrame {
  top: number
  under: number | null
  xm: number
  beta: number
  r: number
}

/** one sheet of the phone reader: the cover, a page, or a whole spread (no gutter fold) */
export type CurlSheet =
  | { kind: 'cover' }
  | { kind: 'page'; page: number }
  | { kind: 'spread'; left: number; right: number }

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
/** `#RRGGBB` → linear-free 0…1 channels (bytes in = bytes out) */
export const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
]
/** the sheet's top / bottom overhang in the canvas (the lifted curl grows toward the viewer) */
export const OV = 24

/** the DOM sheen (`linear-gradient(100deg, rgb(255 255 255/.08), rgb(255 255 255/0) 40%)`) */
function sheen(c: HTMLCanvasElement) {
  const x = ctx(c)
  const W = c.width
  const H = c.height
  const a = (100 * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const L = Math.abs(W * dx) + Math.abs(H * dy)
  const g = x.createLinearGradient(
    W / 2 - (dx * L) / 2,
    H / 2 - (dy * L) / 2,
    W / 2 + (dx * L) / 2,
    H / 2 + (dy * L) / 2,
  )
  g.addColorStop(0, 'rgba(255,255,255,.08)')
  g.addColorStop(0.4, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  return c
}

/** a sheet as one texture `px` wide: the cover, a page, or a spread centred on paper */
export async function sheetCanvas(
  b: GlBook,
  s: CurlSheet,
  px: number,
): Promise<HTMLCanvasElement> {
  if (s.kind === 'cover') return coverCanvas(b, px)
  const PH = Math.round((px * b.h) / b.w)
  const c = cv(px, PH)
  const x = ctx(c)
  if (s.kind === 'page') {
    x.drawImage(await b.face(s.page), 0, 0, px, PH)
    return sheen(c)
  }
  const [l, r] = await Promise.all([b.face(s.left), b.face(s.right)])
  const bh = (px * b.h) / (2 * b.w)
  const y = (PH - bh) / 2
  x.fillStyle = b.paper
  x.fillRect(0, 0, px, PH)
  x.drawImage(l, 0, y, px / 2, bh)
  x.drawImage(r, px / 2, y, px / 2, bh)
  return sheen(c)
}

interface Base {
  sheet: IUniform<Vector2>
  org: IUniform<Vector2>
  cvs: IUniform<Vector2>
  xm: IUniform<number>
  beta: IUniform<number>
  r: IUniform<number>
}
interface SheetUniforms extends Base {
  [k: string]: IUniform<unknown>
  zc: IUniform<number>
  tex: IUniform<CanvasTexture | null>
  crease: IUniform<number>
  back: IUniform<Vector3>
  through: IUniform<number>
}
interface ShadowUniforms extends Base {
  [k: string]: IUniform<unknown>
  dsil: IUniform<number>
}

export class PageCurl {
  /** a sheet texture landed: draw again */
  onChange: () => void = () => undefined
  private readonly texs = new Map<number, CanvasTexture | null>()
  private readonly scene: Scene
  private readonly cam: Camera
  private readonly geo: PlaneGeometry
  private readonly top: Mesh<PlaneGeometry, ShaderMaterial<SheetUniforms>>
  private readonly under: Mesh<PlaneGeometry, ShaderMaterial<SheetUniforms>>
  private readonly shadow: Mesh<PlaneGeometry, ShaderMaterial<ShadowUniforms>>
  private dead = false

  constructor(
    private readonly T: Three,
    private readonly b: GlBook,
    private readonly sheets: readonly CurlSheet[],
    /** sheet texture width */
    private readonly px: number,
    private readonly pw: number,
    private readonly ph: number,
  ) {
    const geo = (this.geo = new T.PlaneGeometry(1, 1, 96, 120))
    const base = (): Base => ({
      sheet: { value: new T.Vector2(pw, ph) },
      org: { value: new T.Vector2(16, OV) },
      cvs: { value: new T.Vector2(1, 1) },
      xm: { value: pw },
      beta: { value: 0 },
      r: { value: 1 },
    })
    // all three in the transparent list, so renderOrder alone stacks them: under, its shadow, the turning sheet
    const sheetMat = () =>
      new T.ShaderMaterial<SheetUniforms>({
        glslVersion: T.GLSL3,
        vertexShader: VS,
        fragmentShader: FS,
        side: T.DoubleSide,
        transparent: true,
        uniforms: {
          ...base(),
          zc: { value: 1 },
          tex: { value: null },
          crease: { value: 0 },
          back: { value: new T.Vector3(...BACK) },
          through: { value: 0.1 },
        },
      })
    const mesh = <U extends Base & Record<string, IUniform<unknown>>>(
      m: ShaderMaterial<U>,
      order: number,
    ) =>
      Object.assign(new T.Mesh(geo, m), {
        frustumCulled: false,
        renderOrder: order,
      })
    this.under = mesh(
      Object.assign(sheetMat(), { depthTest: false, depthWrite: false }),
      -2,
    )
    this.shadow = mesh(
      new T.ShaderMaterial<ShadowUniforms>({
        glslVersion: T.GLSL3,
        vertexShader: SVS,
        fragmentShader: SFS,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { ...base(), dsil: { value: 0 } },
      }),
      -1,
    )
    this.top = mesh(Object.assign(sheetMat(), { depthWrite: true }), 0)
    this.scene = new T.Scene()
    this.scene.add(this.under, this.shadow, this.top)
    this.cam = new T.Camera()
  }

  /** the texture of sheet i is in */
  ready(i: number): boolean {
    return !!this.texs.get(i)
  }

  /** build sheets si − 1 … si + 2, dispose the rest */
  keep(si: number): void {
    for (const [i, t] of this.texs) {
      if (i < si - 1 || i > si + 2) {
        t?.dispose()
        this.texs.delete(i)
      }
    }
    const last = Math.min(this.sheets.length - 1, si + 2)
    for (let i = Math.max(0, si - 1); i <= last; i++) {
      const sheet = this.sheets[i]
      if (this.texs.has(i) || !sheet) continue
      this.texs.set(i, null)
      sheetCanvas(this.b, sheet, this.px).then(
        (c) => {
          if (this.dead || this.texs.get(i) !== null) return
          const t = tex(this.T, c)
          t.colorSpace = this.T.NoColorSpace
          this.texs.set(i, t)
          this.onChange()
        },
        () => undefined,
      )
    }
  }

  /** draw the frame into `out` (backing = CSS size × k); false (nothing drawn) while a texture it needs is missing */
  draw(out: HTMLCanvasElement, k: number, f: CurlFrame): boolean {
    const tt = this.texs.get(f.top)
    const ut = f.under === null ? undefined : this.texs.get(f.under)
    if (!tt || (f.under !== null && !ut)) return false
    const cw = out.width / k
    const ch = out.height / k
    const { pw, ph } = this
    const c = Math.cos(f.beta)
    const s = Math.sin(f.beta)
    const dmax = Math.max(
      (pw - f.xm) * c - (ph / 2) * s,
      (pw - f.xm) * c + (ph / 2) * s,
    )
    const phiMax = Math.min(dmax / f.r, Math.PI)
    const cover = this.sheets[f.top]?.kind === 'cover'
    const u = this.top.material.uniforms
    for (const m of [this.top, this.under, this.shadow]) {
      const v = m.material.uniforms
      v.cvs.value.set(cw, ch)
      v.r.value = f.r
    }
    u.xm.value = f.xm
    u.beta.value = f.beta
    u.zc.value = ch / 2 / Math.tan((9 * Math.PI) / 180)
    u.crease.value = Math.max(0, Math.min(1, phiMax / (Math.PI / 2)))
    const [br, bg, bb] = cover ? hex(this.b.endpaper) : BACK
    u.back.value.set(br, bg, bb)
    u.through.value = cover ? 0 : 0.1
    u.tex.value = tt
    const sv = this.shadow.material.uniforms
    sv.xm.value = f.xm
    sv.beta.value = f.beta
    sv.dsil.value = f.r * Math.sin(Math.max(0, Math.min(phiMax, Math.PI / 2)))
    this.shadow.visible = ut !== undefined && dmax > 0
    this.under.visible = ut !== undefined
    if (ut) {
      const v = this.under.material.uniforms
      v.xm.value = 1e5
      v.tex.value = ut
      v.zc.value = u.zc.value
    }
    drawInto(this.T, this.scene, this.cam, out)
    return true
  }

  dispose(): void {
    this.dead = true
    for (const t of this.texs.values()) t?.dispose()
    this.texs.clear()
    this.geo.dispose()
    for (const m of [this.top, this.under, this.shadow]) m.material.dispose()
  }
}
