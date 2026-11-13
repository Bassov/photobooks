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

/** `drawn`: a fresh token per render, so a late copy knows its pixels are still there */
let shared:
  { r: WebGLRenderer; w: number; h: number; drawn: object } | undefined
/**
 * The page's one renderer: MSAA, transparent, sRGB out, no tone mapping; its
 * drawing buffer only grows and outlives the task (`fencedDraws` copies later).
 */
function renderer(T: Three, w: number, h: number) {
  if (!shared) {
    const r = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    r.setPixelRatio(1)
    r.outputColorSpace = T.SRGBColorSpace
    r.toneMapping = T.NoToneMapping
    r.setClearColor(0x000000, 0)
    shared = { r, w: 0, h: 0, drawn: {} }
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

/** render at `w`×`h` into the shared buffer's top-left corner */
function render(
  T: Three,
  scene: Object3D,
  cam: Camera,
  w: number,
  h: number,
  shadows: boolean,
) {
  const s = renderer(T, w, h)
  const r = s.r
  r.shadowMap.enabled = shadows
  r.shadowMap.type = T.VSMShadowMap
  r.setViewport(0, s.h - h, w, h)
  r.setScissor(0, s.h - h, w, h)
  r.setScissorTest(true)
  r.clear()
  r.render(scene, cam)
  s.drawn = {}
  return s
}

/** copy the last render (`w`×`h`) into `out`, sized to it */
function copy(out: HTMLCanvasElement, w: number, h: number) {
  if (out.width !== w) out.width = w
  if (out.height !== h) out.height = h
  const x = out.getContext('2d')
  if (!x || !shared) return
  x.clearRect(0, 0, w, h)
  x.drawImage(shared.r.domElement, 0, 0, w, h, 0, 0, w, h)
}

/**
 * Render `scene` through `cam` at the 2D canvas' backing size and copy it
 * there in the same task; `shadows`: VSM shadow maps (the open book).
 */
export function drawInto(
  T: Three,
  scene: Object3D,
  cam: Camera,
  out: HTMLCanvasElement,
  shadows = false,
): void {
  render(T, scene, cam, out.width, out.height, shadows)
  copy(out, out.width, out.height)
}

/**
 * Compile the scene's programs off the main thread (KHR_parallel_shader_compile
 * where the GPU has it): the first `render` would link them synchronously.
 */
export const compileScene = async (
  T: Three,
  scene: Object3D,
  cam: Camera,
  shadows: boolean,
): Promise<void> => {
  const r = renderer(T, 1, 1).r
  r.shadowMap.enabled = shadows
  r.shadowMap.type = T.VSMShadowMap
  await r.compileAsync(scene, cam)
}

export interface FencedDraws {
  /**
   * Draw the scene into `out` at `w`×`h` backing px; `prep` runs right
   * before the render it describes. Resolves with `prep`'s value once those
   * pixels are in `out`. `now`: render and copy in this task (a turn the
   * user is watching), taking over the draws in flight.
   */
  draw: <R>(
    out: HTMLCanvasElement,
    w: number,
    h: number,
    prep: () => R,
    now?: boolean,
  ) => Promise<R>
  stop: () => void
}

/**
 * Draws that do not wait for the GPU on the main thread (except `now`): a
 * fence after each render, polled once per `next` (animation frame), and the
 * copy only once it signals, where `drawImage` would block until the frame is
 * done (hundreds of ms a draw on software GL). Draws asked for while one is in
 * flight coalesce into one render of the latest scene; a render of another
 * book over the shared buffer meanwhile costs a re-render.
 */
export function fencedDraws(
  T: Three,
  scene: Object3D,
  cam: Camera,
  shadows: boolean,
  next: (f: () => void) => void = (f) => {
    requestAnimationFrame(f)
  },
): FencedDraws {
  interface Ask {
    out: HTMLCanvasElement
    w: number
    h: number
    prep: () => unknown
    done: ((v: unknown) => void)[]
  }
  /** the next draw to fence, and the one whose fence is pending */
  let ask: Ask | undefined
  let flight: Ask | undefined
  let stopped = false
  const run = () => {
    const a = ask
    ask = undefined
    flight = a
    if (!a) return
    const v = a.prep()
    const s = render(T, scene, cam, a.w, a.h, shadows)
    const mine = s.drawn
    const gl = s.r.getContext()
    // null: a lost context, nothing to wait for
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    gl.flush()
    const poll = () => {
      gl.deleteSync(sync)
      if (stopped) return
      if (s.drawn === mine) {
        copy(a.out, a.w, a.h)
        for (const f of a.done) f(v)
        // a draw `now` took the waiters over: nothing left to re-render
      } else if (a.done.length > 0) ask ??= a
      run()
    }
    const wait = () => {
      if (
        !stopped &&
        sync !== null &&
        gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED
      )
        next(wait)
      else poll()
    }
    next(wait)
  }
  return {
    draw: (out, w, h, prep, now = false) =>
      new Promise((resolve) => {
        if (stopped) return
        const a: Ask = {
          out,
          w,
          h,
          prep,
          done: [...(ask?.done ?? []), resolve as (v: unknown) => void],
        }
        if (!now) {
          ask = a
          if (!flight) run()
          return
        }
        ask = undefined
        const v = prep()
        render(T, scene, cam, w, h, shadows)
        copy(out, w, h)
        const done = [...(flight?.done ?? []), ...a.done]
        if (flight) flight.done = []
        for (const f of done) f(v)
      }),
    stop: () => {
      stopped = true
      ask = undefined
    },
  }
}
