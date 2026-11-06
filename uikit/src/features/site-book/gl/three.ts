/* GL core (Spec site-stand-v2 G, D1): three r170 as a lazy chunk and ONE WebGLRenderer shared by every book on the page.
   Each book renders its scene into the shared renderer, then copies the pixels into its own 2D canvas. */
export type Three = typeof import("./vendor/three.module.min.js")
export type Any = any

import threeUrl from "./vendor/three.module.min.js?url"

let three: Promise<Three> | undefined
/** The vendored build as its own file: the kit is one classic (IIFE) bundle that can't split chunks, so `?url` emits
   `assets/three.module.min.js` as is and a native `import()` loads it on first use. Rejects (e.g. `file://`, where module
   scripts are blocked) → the caller falls back to the CSS book. */
export const loadThree = () => (three ??= import(/* @vite-ignore */ new URL(threeUrl, location.href).href) as Promise<Three>)

const param = (q: string) => new URLSearchParams(q).get("gl")
let webgl2: boolean | undefined
/** GL is on unless `?gl=0` (in the hash route or the search), the kit runs from disk (no module import) or no WebGL2 */
export function glWanted(): boolean {
  if (typeof window === "undefined" || location.protocol === "file:") return false
  if ((param(location.hash.split("?")[1] ?? "") ?? param(location.search)) === "0") return false
  if (webgl2 === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2")
    webgl2 = !!gl
    gl?.getExtension("WEBGL_lose_context")?.loseContext()
  }
  return webgl2
}

let shared: { r: Any; w: number; h: number } | undefined
/** the page's one renderer: MSAA, transparent, sRGB out, no tone mapping; its drawing buffer only grows */
function renderer(T: Three, w: number, h: number) {
  if (!shared) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
    r.setPixelRatio(1)
    r.outputColorSpace = T.SRGBColorSpace
    r.toneMapping = T.NoToneMapping
    r.setClearColor(0x000000, 0)
    shared = { r, w: 0, h: 0 }
  }
  if (w > shared.w || h > shared.h) {
    shared.w = Math.max(w, shared.w)
    shared.h = Math.max(h, shared.h)
    shared.r.setSize(shared.w, shared.h, false)
  }
  return shared
}
export const maxAnisotropy = (T: Three) => renderer(T, 1, 1).r.capabilities.getMaxAnisotropy() as number

/** render `scene` through `cam` at the 2D canvas' backing size and copy it there (same task: no preserveDrawingBuffer) */
export function drawInto(T: Three, scene: Any, cam: Any, out: HTMLCanvasElement) {
  const w = out.width, h = out.height, s = renderer(T, w, h), r = s.r
  r.setViewport(0, s.h - h, w, h)
  r.setScissor(0, s.h - h, w, h)
  r.setScissorTest(true)
  r.clear()
  r.render(scene, cam)
  const x = out.getContext("2d")
  if (!x) return
  x.clearRect(0, 0, w, h)
  x.drawImage(r.domElement, 0, 0, w, h, 0, 0, w, h)
}
