/* #/demo Preview = prod presentation mode (src/render/SpreadPager.tsx + src/editor/PresentationMode.tsx, M16 / M53): full-screen black,
   one spread at a time fitted to the window, opens on the cover; "Esc" chip top-right, page caption bottom centre.
   Colours are prod's styles/tokens.css values: --presentation-ink white/0.6, --presentation-chip white/0.1 (hover 0.2). */
import * as React from "react"
import { MiniSpread } from "@/sandbox/chrome"
import { SW, SH } from "@/sandbox/model"
import { useStudio } from "@/sandbox/store"
import { coverW } from "@/sandbox/v7"
import { SiteCover } from "./site"

/** Caption: the cover, then spreads numbered from 1 (doc spread 0 is the cover). */
const caption = (i: number, n: number) => (i === 0 ? "Cover" : `${i} / ${n - 1}`)

export function Presentation({ onExit }: { onExit: () => void }) {
  const st = useStudio()
  const n = st.doc.spreads.length
  const [i, setI] = React.useState(0)
  const [box, setBox] = React.useState({ w: 0, h: 0 })
  const ref = React.useRef<HTMLDivElement>(null)
  const swipe = React.useRef<number | null>(null), swiped = React.useRef(false)
  const live = React.useRef({ n, onExit }); live.current = { n, onExit }
  const go = (d: number) => setI((x) => Math.max(0, Math.min(live.current.n - 1, x + d)))
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return // Alt+← / → stay the kit's page navigation
      const d = e.key === "ArrowRight" || e.key === " " ? 1 : e.key === "ArrowLeft" ? -1 : 0
      if (!d && e.key !== "Escape") return
      e.preventDefault(); e.stopPropagation()
      if (d) go(d); else live.current.onExit()
    }
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true)
  }, [])
  // measure the dialog itself (fixed inset-0): the window, or a transformed kit page frame
  React.useLayoutEffect(() => { const el = ref.current; if (!el) return; const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r(); const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect() }, [])
  const ratio = i === 0 ? coverW(st.book) / st.book.h : SW / SH
  // prod fit: 94 % of the width, 96 % of the height less 64 px for the caption
  const w = Math.max(0, Math.min(box.w * 0.94, (box.h - 64) * 0.96 * ratio))
  return (
    <div ref={ref} className="fixed inset-0 z-[80] touch-pan-y overflow-hidden bg-presentation text-[rgb(255_255_255/0.6)] select-none" role="dialog" aria-modal="true" aria-label="Presentation" data-testid="presentation"
      onPointerDown={(e) => { swipe.current = e.clientX; swiped.current = false }}
      onPointerUp={(e) => { const s = swipe.current; swipe.current = null; if (s !== null && Math.abs(e.clientX - s) > 60) { swiped.current = true; go(e.clientX < s ? 1 : -1) } }}
      onClick={(e) => { if (swiped.current) { swiped.current = false; return } const r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left > r.width / 2 ? 1 : -1) }}>
      <div className="absolute inset-0 grid place-items-center" data-testid="presentation-slide" data-active="true">
        {w > 0 && <div className="shadow-stage-dark" style={{ width: w }}>{i === 0 ? <div data-testid="presentation-cover"><SiteCover w={w} /></div> : <MiniSpread s={st.doc.spreads[i]} width={w} si={i} />}</div>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs"><span className="tabular-nums" data-testid="pager-position">{n === 0 ? "" : caption(i, n)}</span></div>
      <button type="button" className="absolute right-4 top-4 grid h-8 cursor-pointer place-items-center rounded-full border-0 bg-[rgb(255_255_255/0.1)] px-3 text-xs text-white hover:bg-[rgb(255_255_255/0.2)]" aria-label="Exit presentation" data-testid="presentation-exit"
        onClick={(e) => { e.stopPropagation(); onExit() }}>Esc</button>
    </div>
  )
}
