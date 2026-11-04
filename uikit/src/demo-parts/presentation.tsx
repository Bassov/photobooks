/* #/demo Preview = prod presentation mode (src/render/SpreadPager.tsx + src/editor/PresentationMode.tsx, M16 / M53): full-screen black,
   one slide at a time fitted to the window, opens on the cover; "Esc" chip top-right, page caption bottom centre.
   Slides follow the spread list after the cover: page 1 alone, the spreads, the last page alone (single pages one page wide, centred).
   Colours are prod's styles/tokens.css values: --presentation-ink white/0.6, --presentation-chip white/0.1 (hover 0.2). */
import * as React from "react"
import { MiniSpread } from "@/sandbox/chrome"
import { SW, SH, lastPageFolios } from "@/sandbox/model"
import { useStudio } from "@/sandbox/store"
import { coverW, CoverSpread, FolioMarks, PAPER } from "@/sandbox/v7"

/** Prod cover slide (PresentationMode.tsx, CoverCanvas.css): 0.5 px / mm wide, the canvas texts (34 / 12 / 11 px) at the cover width / 848 */
const COVER_PX_PER_MM = 0.5, COVER_FIT_PX = 848

/** Caption: the cover, then the list rows numbered from 1. */
const caption = (i: number, n: number) => (i === 0 ? "Cover" : `${i} / ${n - 1}`)

export function Presentation({ onExit }: { onExit: () => void }) {
  const st = useStudio(), bk = st.book
  const spreads = st.doc.spreads.length
  const n = spreads ? spreads + 2 : 1 // cover · page 1 · spreads 2–3 … · last page
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
  /** natural size + content of slide `j` */
  const slide = (j: number): [number, number, React.ReactNode] => {
    if (j === 0) { const cw = coverW(bk) * 10 * COVER_PX_PER_MM; return [cw, bk.h * 10 * COVER_PX_PER_MM, <div className="size-full" data-testid="presentation-cover"><CoverSpread slide={cw / COVER_FIT_PX} /></div>] }
    // Designer page-numbers: every page slide prints its folios (1 px / mm here, the slide box scales it)
    if (j === 1) return [SW / 2, SH, <div className="-ml-[100%] w-[200%]" data-testid="presentation-page"><MiniSpread s={st.doc.spreads[0]} width={SW} si={0} folios className="rounded-none shadow-none!" /></div>]
    if (j === n - 1) return [SW / 2, SH, <div className="relative size-full" style={{ background: PAPER }} data-paper data-testid="presentation-page"><FolioMarks folios={lastPageFolios(st.doc, st.book.safe, st.view.pageNumbers)} sc={1} /></div>]
    return [SW, SH, <MiniSpread s={st.doc.spreads[j - 1]} width={SW} si={j - 1} folios className="rounded-none shadow-none!" />]
  }
  return (
    <div ref={ref} className="fixed inset-0 z-[80] touch-pan-y overflow-hidden bg-presentation text-[rgb(255_255_255/0.6)] select-none" role="dialog" aria-modal="true" aria-label="Presentation" data-testid="presentation"
      onPointerDown={(e) => { swipe.current = e.clientX; swiped.current = false }}
      onPointerUp={(e) => { const s = swipe.current; swipe.current = null; if (s !== null && Math.abs(e.clientX - s) > 60) { swiped.current = true; go(e.clientX < s ? 1 : -1) } }}
      onClick={(e) => { if (swiped.current) { swiped.current = false; return } const r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left > r.width / 2 ? 1 : -1) }}>
      {/* prod: the neighbours stay mounted at opacity 0; slides move sideways and fade, 200 ms ease-out, none under reduced motion */}
      {[i - 1, i, i + 1].filter((j) => j >= 0 && j < n).map((j) => {
        const [w, h, node] = slide(j), active = j === i
        // prod fit: 94 % of the width, 96 % of the height less 64 px for the caption
        const sc = box.w > 0 ? Math.max(0, Math.min((box.w * 0.94) / w, ((box.h - 64) * 0.96) / h)) : 0
        return (
          <div key={j} className="absolute inset-0 grid place-items-center transition-[transform,opacity] duration-(--duration-base) ease-(--ease-out) will-change-transform motion-reduce:transition-none data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
            data-testid="presentation-slide" data-active={active ? "true" : "false"} aria-hidden={active ? undefined : true} inert={!active || undefined}
            style={{ transform: `translateX(${(j - i) * 100}%)` }}>
            {/* the shadow sits on the unscaled box (prod) */}
            {sc > 0 && <div className="shadow-stage-dark" style={{ width: w * sc, height: h * sc }}>
              <div className="origin-top-left overflow-hidden" style={{ width: w, height: h, transform: `scale(${sc})` }}>{node}</div></div>}
          </div>
        )
      })}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs leading-4"><span className="tabular-nums" data-testid="pager-position">{caption(i, n)}</span></div>
      <button type="button" className="absolute right-4 top-4 grid h-8 cursor-pointer place-items-center rounded-full border-0 bg-[rgb(255_255_255/0.1)] px-3 text-xs leading-4 text-white hover:bg-[rgb(255_255_255/0.2)]" aria-label="Exit presentation" data-testid="presentation-exit"
        onClick={(e) => { e.stopPropagation(); onExit() }}>Esc</button>
    </div>
  )
}
