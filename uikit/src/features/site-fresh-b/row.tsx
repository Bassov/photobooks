/* site-fresh-b, the row: the books stand one behind another, cover forward, seen at three quarters so every spine shows.
   Grab the front book and pull it aside: it slides out and goes to the back of the row. A flick riffles several, a drag
   the other way brings the last one forward. A click opens the front book; a click on a spine brings that book forward.
   Sizes are true (px per cm `s`, shared by every book); reduced motion swaps the order with a fade. */
import * as React from "react"
import { Book3D, thick } from "../site-demo-1/book3d"
import { pagesOf, type SiteBook } from "../site-demo-1/data"

const TILT = 9
const GAP_CM = 2.4
const OUT = "cubic-bezier(0.4, 0, 0.2, 1)"
const IN = "cubic-bezier(0.16, 1, 0.3, 1)"
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const rad = (d: number) => (d * Math.PI) / 180
const tcm = (b: SiteBook) => 0.6 + (pagesOf(b) / 2) * 0.1
const tf = (x: number, z: number) => `translate3d(${x.toFixed(2)}px, 0px, ${z.toFixed(2)}px)`

/** px per cm so the whole row (every spine + the widest book) fits w × h; capped so a short row is not oversized */
export function rowScale(books: SiteBook[], w: number, h: number, ang: number) {
  const depth = books.reduce((a, b) => a + tcm(b) + GAP_CM, 0)
  const maxW = Math.max(...books.map((b) => b.w)), maxH = Math.max(...books.map((b) => b.h))
  const sw = w / (depth * Math.sin(rad(ang)) + maxW * Math.cos(rad(ang)) + 6)
  const sh = h / (maxH + depth * Math.sin(rad(TILT)) + 5)
  return Math.min(sw, sh, 16)
}

export type RowApi = { go: (i: number) => void; step: (d: 1 | -1) => void }
type Props = {
  books: SiteBook[]; front: number; onFront: (i: number) => void; onOpen: (i: number) => void
  w: number; h: number; ang: number
}

export const Row = React.forwardRef<RowApi, Props>(function Row({ books, front, onFront, onOpen, w, h, ang }, ref) {
  const n = books.length
  const s = rowScale(books, w, h, ang)
  const T = books.map((b) => thick(b, s))
  const gap = GAP_CM * s
  /** centre-plane z of every book when book f stands in front */
  const zsFor = React.useCallback((f: number) => {
    const z: number[] = new Array(n)
    let acc = 0
    for (let j = 0; j < n; j++) {
      const i = (f + j) % n
      if (j) acc -= T[(f + j - 1) % n] / 2 + T[i] / 2 + gap
      z[i] = acc
    }
    return z
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, s])
  const z = zsFor(front)
  // the layout does not depend on the order, so nothing shifts when the front book changes
  const depth = T.reduce((a, t) => a + t, 0) + (n - 1) * gap
  const maxW = Math.max(...books.map((b) => b.w)) * s
  const fan = depth * Math.sin(rad(ang))
  const ox = Math.max(0, (w - fan - maxW * Math.cos(rad(ang))) / 2) + fan
  const oy = h - 20
  const xOut = maxW + s

  const els = React.useRef(new Map<string, HTMLDivElement>())
  const stage = React.useRef<HTMLDivElement>(null)
  const anims = React.useRef<Animation[]>([])
  const cur = React.useRef(front)
  const pending = React.useRef<{ target: number; dir: 1 | -1 } | null>(null)
  const live = React.useRef({ onFront, onOpen, zsFor, books })
  live.current = { onFront, onOpen, zsFor, books }
  React.useEffect(() => { if (!anims.current.length) cur.current = front }, [front])

  /** write the resting transforms (the same strings React renders) and drop the finished animations */
  const rest = () => {
    const zz = live.current.zsFor(cur.current)
    for (const a of anims.current) a.cancel()
    anims.current = []
    live.current.books.forEach((b, i) => { const e = els.current.get(b.id); if (e) e.style.transform = tf(0, zz[i]) })
    stage.current?.classList.remove("is-moving")
    const p = pending.current; pending.current = null
    if (p) animateTo(p.target, p.dir)
  }
  const whenDone = () => { const list = anims.current; void Promise.all(list.map((a) => a.finished)).then(() => { if (anims.current === list) rest() }, () => {}) }

  const snapBack = (x0: number) => {
    const e = els.current.get(books[cur.current].id); if (!e || reduced()) { rest(); return }
    anims.current = [e.animate([{ transform: tf(x0, 0) }, { transform: tf(0, 0) }], { duration: 420, easing: IN, fill: "both" })]
    whenDone()
  }

  /** move the row so `target` stands in front: dir 1 sends the front books to the back, -1 brings the back ones forward */
  const animateTo = (target: number, dir: 1 | -1, x0 = 0) => {
    if (anims.current.length) { pending.current = { target, dir }; return }
    const f = cur.current
    const k = dir > 0 ? (target - f + n) % n : (f - target + n) % n
    if (!k) { snapBack(x0); return }
    const zo = zsFor(f), zn = zsFor(target)
    cur.current = target
    live.current.onFront(target)
    if (reduced()) {
      anims.current = stage.current ? [stage.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: OUT })] : []
      whenDone(); return
    }
    stage.current?.classList.add("is-moving")
    const stagger = k > 3 ? 70 : 120
    books.forEach((b, i) => {
      const e = els.current.get(b.id); if (!e) return
      const so = (i - f + n) % n
      const wraps = dir > 0 ? so < k : so >= n - k
      const xs = so === 0 ? x0 : 0
      if (wraps) {
        const order = dir > 0 ? so : n - 1 - so
        anims.current.push(e.animate([
          { transform: tf(xs, zo[i]), easing: OUT },
          { transform: tf(xOut, zo[i]), offset: 0.38, easing: "ease-in-out" },
          { transform: tf(xOut, zn[i]), offset: 0.56, easing: IN },
          { transform: tf(0, zn[i]) },
        ], { duration: 860, delay: order * stagger, fill: "both" }))
      } else {
        anims.current.push(e.animate([{ transform: tf(xs, zo[i]) }, { transform: tf(0, zn[i]) }],
          { duration: 560, delay: dir > 0 ? 300 + (k - 1) * stagger : 0, easing: IN, fill: "both" }))
      }
    })
    whenDone()
  }

  React.useImperativeHandle(ref, () => ({
    go: (i) => { const fw = (i - cur.current + n) % n; if (fw) animateTo(i, fw <= n - fw ? 1 : -1) },
    step: (d) => animateTo((cur.current + d + n) % n, d),
  }))

  // the hand: press anywhere on the row, pull sideways (6 px), release; vertical moves stay page scroll
  const drag = React.useRef<{ id: number; x0: number; y0: number; on: boolean; i: number; lx: number; lt: number; vx: number; dx: number } | null>(null)
  const k = Math.cos(rad(ang))
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || anims.current.length) return
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-i]"); if (!t) return
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, i: Number(t.dataset.i), lx: e.clientX, lt: e.timeStamp, vx: 0, dx: 0 }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0
    if (!d.on) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - d.y0) || n < 2) return
      d.on = true; stage.current?.setPointerCapture(e.pointerId); stage.current?.classList.add("is-grab")
    }
    const dt = e.timeStamp - d.lt; if (dt > 0) d.vx = (e.clientX - d.lx) / dt
    d.lx = e.clientX; d.lt = e.timeStamp; d.dx = dx
    const el = els.current.get(books[cur.current].id)
    if (el && !reduced()) el.style.transform = tf((dx > 0 ? dx : dx * 0.3) / k, 0)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null
    if (!d || d.id !== e.pointerId) return
    stage.current?.classList.remove("is-grab")
    if (!d.on) { if (d.i === cur.current) live.current.onOpen(d.i); else animateTo(d.i, 1); return }
    if (e.timeStamp - d.lt > 120) d.vx = 0 // the hand rested before letting go: no throw
    const x0 = reduced() ? 0 : (d.dx > 0 ? d.dx : d.dx * 0.3) / k
    const fw = d.dx > w * 0.12 || d.vx > 0.45, bw = d.dx < -40 || d.vx < -0.45
    const many = (v: number) => Math.min(n - 1, 1 + Math.floor(Math.max(0, Math.abs(v) - 0.9) * 2.5))
    if (fw && d.dx > 0) animateTo((cur.current + many(d.vx)) % n, 1, x0)
    else if (bw && d.dx < 0) animateTo((cur.current - many(d.vx) + n * 12) % n, -1, x0)
    else snapBack(x0)
  }
  const onPointerCancel = () => {
    const d = drag.current; drag.current = null
    stage.current?.classList.remove("is-grab")
    if (d?.on) snapBack((d.dx > 0 ? d.dx : d.dx * 0.3) / k)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = ({ ArrowRight: 1, ArrowLeft: -1 } as const)[e.key as "ArrowRight"]
    if (d) {
      e.preventDefault(); animateTo((cur.current + d + n) % n, d)
      // the focus follows the front book
      requestAnimationFrame(() => els.current.get(books[cur.current].id)?.querySelector<HTMLElement>(".sfb-lift")?.focus({ preventScroll: true }))
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const i = Number((e.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i ?? cur.current)
      if (i === cur.current) live.current.onOpen(i); else animateTo(i, 1)
    }
  }

  return (
    <div className="sfb-scene" style={{ width: w, height: h, perspectiveOrigin: `${Math.round(w / 2)}px ${Math.round(h * 0.35)}px` }} data-testid="sfb-row" data-front={books[front].id}>
      <div ref={stage} className="sfb-stage" style={{ left: ox, top: oy, transform: `rotateX(${-TILT}deg) rotateY(${ang}deg)` }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}
        role="list" aria-label="Books">
        {books.map((b, i) => {
          const slot = (i - front + n) % n, W = b.w * s
          return (
            <div key={b.id} ref={(e) => { if (e) els.current.set(b.id, e); else els.current.delete(b.id) }} role="listitem"
              className={slot === 0 ? "sfb-slot is-front" : "sfb-slot"} style={{ transform: tf(0, z[i]) }} data-i={i} data-slot={slot}>
              <div className="sfb-shadow" style={{ left: W * 0.02, width: W * 1.08, height: T[i] + 5 * s, top: -(T[i] + 5 * s) / 2, transform: `translateZ(${(-1.2 * s).toFixed(1)}px) rotateX(90deg)` }} />
              <div className="sfb-lift" tabIndex={slot === 0 ? 0 : -1} role="button"
                aria-label={slot === 0 ? `${b.title}, ${b.year}. Open the book` : `${b.title}, ${b.year}. Bring forward`}>
                <Book3D b={b} s={s} floor={false} className="sfb-book" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
