/*
 * GL core (Designer D44; port of the kit's `site-book/gl/three.ts`): three
 * r170 as a lazy chunk and ONE WebGLRenderer shared by every book on the
 * page. Each book renders its scene into the shared renderer, then copies the
 * pixels into its own 2D canvas.
 */
import type {
  Camera,
  Object3D,
  WebGLRenderer,
} from './vendor/three.module.min.js'

export type Three = typeof import('./vendor/three.module.min.js')

let three: Promise<Three> | undefined
/** The vendored build, loaded on first use: Vite emits it as its own chunk. */
export const loadThree = (): Promise<Three> =>
  (three ??= import('./vendor/three.module.min.js'))

let shared: { r: WebGLRenderer; w: number; h: number } | undefined
/** The page's one renderer: MSAA, transparent, sRGB out, no tone mapping; its drawing buffer only grows. */
function renderer(T: Three, w: number, h: number) {
  if (!shared) {
    const r = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
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

export const maxAnisotropy = (T: Three): number =>
  renderer(T, 1, 1).r.capabilities.getMaxAnisotropy()

/**
 * Render `scene` through `cam` at the 2D canvas' backing size and copy it
 * there (same task: no preserveDrawingBuffer); `shadows`: VSM shadow maps
 * (the open book).
 */
export function drawInto(
  T: Three,
  scene: Object3D,
  cam: Camera,
  out: HTMLCanvasElement,
  shadows = false,
): void {
  const w = out.width
  const h = out.height
  const s = renderer(T, w, h)
  const r = s.r
  r.shadowMap.enabled = shadows
  r.shadowMap.type = T.VSMShadowMap
  r.setViewport(0, s.h - h, w, h)
  r.setScissor(0, s.h - h, w, h)
  r.setScissorTest(true)
  r.clear()
  r.render(scene, cam)
  const x = out.getContext('2d')
  if (!x) return
  x.clearRect(0, 0, w, h)
  x.drawImage(r.domElement, 0, 0, w, h, 0, 0, w, h)
}
