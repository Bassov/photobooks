/* Book3D (Spec site-stand-v2 G, D1): the closed hardcover drawn by the page's one WebGL renderer (`gl/`). The host keeps
   the old W×H box (layouts and hit areas don't move); a 2D canvas overhangs it (`OVER`) at max(2, dpr)× backing. The pose
   follows the nearest host (`.sd-host`, a link or a button: hover / focus-visible / active) or `pose`, tweened 600 ms.
   Fallback: the CSS book (`book3d-css.tsx`) for `?gl=0`, no WebGL2, or a failed three import. */
import * as React from "react"
import { Book3DCss, type Book3DProps, type Pose } from "./book3d-css"
import "./book3d.css"
import { ACTIVE, canvasBox, ClosedBook, HOVER, REST, type GlPose, type TitleFont } from "./gl/closed"
import { drawInto, glWanted, loadThree, type Three } from "./gl/three"

export { SPINE_SHADE, thick, type Pose } from "./book3d-css"

/** cubic-bezier(.16, 1, .3, 1) */
function ease(t: number) {
  const x1 = 0.16, y1 = 1, x2 = 0.3, y2 = 1
  const bz = (u: number, a: number, b: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bz(m, x1, x2) < t) lo = m; else hi = m }
  return bz((lo + hi) / 2, y1, y2)
}
const mix = (a: GlPose, b: GlPose, u: number): GlPose => ({ ry: a.ry + (b.ry - a.ry) * u, elev: a.elev + (b.elev - a.elev) * u, lift: a.lift + (b.lift - a.lift) * u, peek: a.peek + (b.peek - a.peek) * u, rz: a.rz + (b.rz - a.rz) * u })
const same = (a: GlPose, b: GlPose) => a.ry === b.ry && a.elev === b.elev && a.lift === b.lift && a.peek === b.peek && a.rz === b.rz
/** a CSS pose (rx −14 at rest, −9 on hover) as eye elevation (20°, 16°) */
const fromCss = (p: Pose): GlPose => ({ ry: p.ry, elev: 20 + (-p.rx - 14) * 0.8, lift: p.lift ?? 0, peek: p.peek ?? 0, rz: p.rz ?? 0 })

function titleFont(probe: HTMLElement, host: HTMLElement): TitleFont {
  const c = getComputedStyle(probe), h = getComputedStyle(host), num = (v: string, d: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d)
  return { family: c.fontFamily, weight: c.fontWeight, style: c.fontStyle, variation: c.fontVariationSettings, k: num(h.getPropertyValue("--cover-k"), 0.14), ls: num(h.getPropertyValue("--cover-ls"), -0.02) }
}

const Book3DGl = React.forwardRef<HTMLDivElement, Book3DProps & { onFail: () => void }>(function Book3DGl({ b, s, pose, floor = true, className, onFail }, ref) {
  const W = b.w * s, H = b.h * s, box = canvasBox(b, s)
  const root = React.useRef<HTMLDivElement | null>(null), canvas = React.useRef<HTMLCanvasElement>(null), probe = React.useRef<HTMLSpanElement>(null)
  const poseRef = React.useRef(pose), retarget = React.useRef<() => void>(() => {})
  poseRef.current = pose
  const fail = React.useRef(onFail)
  fail.current = onFail
  const setRef = React.useCallback((el: HTMLDivElement | null) => {
    root.current = el
    if (typeof ref === "function") ref(el)
    else if (ref) ref.current = el
  }, [ref])

  React.useEffect(() => {
    const el = root.current, cv = canvas.current
    if (!el || !cv) return
    const k = Math.max(2, window.devicePixelRatio || 1)
    cv.width = Math.round(box.width * k)
    cv.height = Math.round(box.height * k)
    const host = el.closest<HTMLElement>(".sd-host, a, button"), reduce = matchMedia("(prefers-reduced-motion: reduce)")
    let dead = false, T: Three | undefined, view: ClosedBook | undefined, raf = 0, t0 = 0
    let hover = false, focus = false, active = false
    const target = (): GlPose => {
      if (poseRef.current) return fromCss(poseRef.current)
      if (reduce.matches) return REST
      return active ? ACTIVE : hover || focus ? HOVER : REST
    }
    let cur = target(), from = cur, to = cur
    const draw = () => {
      if (!view || !T) return
      view.pose(cur)
      drawInto(T, view.scene, view.cam, cv)
    }
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / 600)
      cur = u >= 1 ? to : mix(from, to, ease(u))
      draw()
      raf = u < 1 && !dead ? requestAnimationFrame(step) : 0
    }
    retarget.current = () => {
      const next = target()
      if (same(next, to)) return
      from = cur
      to = next
      if (reduce.matches || !view) { cur = to; draw(); return }
      t0 = performance.now()
      if (!raf) raf = requestAnimationFrame(step)
    }
    const on: [string, (e: Event) => void][] = [
      ["pointerenter", () => { hover = true; retarget.current() }],
      ["pointerleave", () => { hover = false; active = false; retarget.current() }],
      ["pointerdown", () => { active = true; retarget.current() }],
      ["pointerup", () => { active = false; retarget.current() }],
      ["pointercancel", () => { active = false; retarget.current() }],
      ["focus", () => { focus = !!host?.matches(":focus-visible"); retarget.current() }],
      ["blur", () => { focus = false; retarget.current() }],
    ]
    for (const [t, f] of on) host?.addEventListener(t, f)
    const start = async () => {
      try {
        T = await loadThree()
        const v = await ClosedBook.create(T, b, s, { dark: !!el.closest(".ss-dark"), floor, font: titleFont(probe.current ?? el, el), k })
        if (dead) { v.dispose(); return }
        view = v
        draw()
        el.dataset.gl = "ready"
      } catch (e) {
        if (!dead) { console.warn("Book3D: GL failed, CSS fallback", e); fail.current() }
      }
    }
    // build when near the viewport: 100 books on a page load their covers as they scroll in
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); void start() } }, { rootMargin: "400px" })
    io.observe(el)
    return () => {
      dead = true
      io.disconnect()
      cancelAnimationFrame(raf)
      for (const [t, f] of on) host?.removeEventListener(t, f)
      view?.dispose()
      retarget.current = () => {}
    }
    // box follows b and s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, s, floor])
  React.useEffect(() => { retarget.current() }, [pose?.ry, pose?.rx, pose?.rz, pose?.lift, pose?.peek])

  return (
    <div ref={setRef} className={`sd-b3wrap sd-b3gl sd-ring${className ? ` ${className}` : ""}`} style={{ position: "relative", width: W, height: H }} data-testid="book3d" data-book={b.id}>
      <canvas ref={canvas} aria-hidden data-testid="book3d-gl" style={{ position: "absolute", pointerEvents: "none", ...box }} />
      <span ref={probe} className="sd-it" aria-hidden style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap" }} />
    </div>
  )
})

/** API unchanged: the GL book, or the CSS book when GL is off or fails */
export const Book3D = React.forwardRef<HTMLDivElement, Book3DProps>(function Book3D(props, ref) {
  const [css, setCss] = React.useState(() => !glWanted())
  const onFail = React.useCallback(() => setCss(true), [])
  return css ? <Book3DCss ref={ref} {...props} /> : <Book3DGl ref={ref} {...props} onFail={onFail} />
})
