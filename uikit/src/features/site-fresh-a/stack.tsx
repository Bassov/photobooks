/* The pile: every book lying flat, spine to the viewer, at true relative size, in one CSS 3D world seen from a little above.
   The newest book is on top. Hover pulls one book 14 px out of the pile; nothing else moves. */
import * as React from "react"
import { Book3D, thick } from "../site-demo-1/book3d"
import { pagesOf, type SiteBook } from "../site-demo-1/data"

const A = 70
const COS = Math.cos((A * Math.PI) / 180), SIN = Math.sin((A * Math.PI) / 180)
/** deterministic misalignment, px at s = 20: a real pile is never square */
const JX = [0, -14, 9, -6, 16, -10, 5, -16, 12, -4, 8, -12]
const JY = [0, 5, 2, 8, 3, 6, 1, 7, 4, 2, 6, 3]

/** px per cm so the pile fits availW × availH */
export function pileScale(books: SiteBook[], availW: number, availH: number, cap = 26) {
  const maxH = Math.max(...books.map((b) => b.h)), maxW = Math.max(...books.map((b) => b.w))
  const sumK = books.reduce((a, b) => a + 0.6 + (pagesOf(b) / 2) * 0.1, 0)
  return Math.max(4, Math.min(cap, (availW - 40) / maxH, (availH - 80) / (maxW * COS + sumK * SIN)))
}

export function Pile({ books, s, hot, onHot, onPick }: {
  books: SiteBook[]; s: number; hot: string | null; onHot: (id: string | null) => void; onPick: (id: string) => void
}) {
  const maxH = Math.max(...books.map((b) => b.h)), maxW = Math.max(...books.map((b) => b.w))
  const worldW = maxH * s, worldD = maxW * s
  const k = s / 20
  // bottom → top: the oldest book lies lowest
  const order = [...books].reverse()
  let z = 0
  const items = order.map((b) => { const T = thick(b, s), at = z + T / 2; z += T; return { b, T, at } })
  const totalT = z
  // the perspective throws the front edge ~5 % below its flat projection: keep 56 px under it
  const Hv = Math.ceil(worldD * COS + totalT * SIN + 80)
  const yc = Hv - 56 - (worldD / 2) * COS
  return (
    <div className="stk" style={{ width: worldW + 40, height: Hv }} data-testid="sfa-pile" onMouseLeave={() => onHot(null)}>
      <div className="stk-world" style={{ left: 20, top: yc - worldD / 2, width: worldW, height: worldD, transform: `rotateX(${A}deg)` }}>
        <div className="stk-shadow" style={{ left: -8, top: -4, width: worldW + 16, height: worldD + 20 }} />
        {items.map(({ b, at }) => {
          const i = books.indexOf(b), W = b.w * s, H = b.h * s
          const vars = { "--tx": `${JX[i % 12] * k}px`, "--ty": `${(maxW - b.w) * s / 2 + JY[i % 12] * k}px`, "--z": `${at}px` } as React.CSSProperties
          return (
            <div key={b.id} className="stk-item" data-hot={hot === b.id || undefined} data-book={b.id}
              style={{ left: (worldW - W) / 2, top: (worldD - H) / 2, width: W, height: H, ...vars }}
              onMouseEnter={() => onHot(b.id)} onClick={() => onPick(b.id)} aria-hidden>
              <Book3D b={b} s={s} pose={{ ry: 0, rx: 0, rz: -90 }} floor={false} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
