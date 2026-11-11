/* Personal site shelf layout (Spec site-stand-v3 B2, D13, site-stand-v7 D30): the TS port of the Designer's reference `shelf.js`, kept as
   written. Pure: books → rows of items in case px. Units: s px/cm (already × z), z = case scale (≥ 1). */
import { pagesOf, type SiteBook } from './sample'

/** lean angles (deg), picked by hash */
export const THETA = [10, 11, 12, 13, 14]
/** FNV-1a 32 + a murmur3 finaliser (sequential ids like book-13, book-14 must not give periodic patterns) */
export const hash = (id: string) => {
  let h = 0x811c9dc5
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}
const rad = Math.PI / 180
export const thickCm = (b: SiteBook) => 0.6 + (pagesOf(b) / 2) * 0.1
export const spineW = (b: SiteBook, s: number, z: number) => Math.max(24 * z, thickCm(b) * 2.4 * s)
export const faceW = (b: SiteBook, s: number, z: number) => b.w * s + 8 * z

/** P0 face · run · lean←, P1 stack · run · gap · face, P2 run · face · run · lean←, P3 face · gap · lean→ · run · stack */
export type Pattern = 0 | 1 | 2 | 3
export type Item = {
  b: SiteBook
  kind: 'face' | 'spine' | 'flat'
  /** left of the element, from the row's left */
  x: number
  w: number
  h: number
  /** bottom */
  y: number
  /** deg, CSS rotate */
  lean: number
  /** pivot: bottom-left or bottom-right corner */
  origin?: 'l' | 'r'
}
export type Row = { items: Item[]; width: number; height: number; p: Pattern }

/** pattern of the shelf that starts with book `first`: shelf 0 → P0; then one of the patterns used by neither of the two
   shelves above, picked by hash(first id) → no shelf repeats its neighbour, no A·B·A·B */
export function nextPattern(ps: Pattern[], first: SiteBook): Pattern {
  if (!ps.length) return 0
  const c = ([0, 1, 2, 3] as const).filter((p) => !ps.slice(-2).includes(p))
  return c[hash(first.id) % c.length]
}
/** books per shelf: 9…13 from the hash of the shelf's first (newest) book (site-stand-v7 D30) */
export const capOf = (first: SiteBook) => 9 + (hash(first.id) % 5)

/** lean geometry: a spine (w, h) resting on its neighbour (top hn) at θ; returns the horizontal room it takes past the neighbour */
export function leanRoom(w: number, h: number, hn: number, th: number) {
  const yc = Math.min(hn, h * Math.cos(th * rad))
  return { yc, room: yc * Math.tan(th * rad) - 2 + w * Math.cos(th * rad) }
}

/** one row; `inner` = the bay width free for the row (P1 puts the face at its right end, P3 right-aligns run + stack) */
export function rowOf(r: SiteBook[], p: Pattern, s: number, z: number, inner: number): Row {
  const sw = (b: SiteBook) => spineW(b, s, z), hp = (b: SiteBook) => b.h * s
  const [f, ...sp] = r
  const stack = (p === 1 || p === 3) && sp.length >= 5 ? [...sp].sort((a, b) => sw(a) - sw(b)).slice(0, 2).reverse() : []
  const rest = sp.filter((b) => !stack.includes(b))
  const th = THETA[hash(f.id) % THETA.length]
  const items: Item[] = [], GAP = 24 * z
  const face = (x: number) => items.push({ b: f, kind: 'face', x, w: faceW(f, s, z), h: hp(f), y: 0, lean: 0 })
  const run = (bs: SiteBook[], x: number) => {
    for (const b of bs) {
      items.push({ b, kind: 'spine', x, w: sw(b), h: hp(b), y: 0, lean: 0 })
      x += sw(b) + 1
    }
    return x
  }
  const stackAt = (x: number) => {
    let y = 0
    const L = Math.max(...stack.map(hp))
    for (const b of stack) {
      items.push({ b, kind: 'flat', x, w: hp(b), h: sw(b), y, lean: 0 })
      y += sw(b)
    }
    return x + L
  }
  const leanL = (b: SiteBook, xn: number, hn: number) => {
    const { yc } = leanRoom(sw(b), hp(b), hn, th)
    const x0 = xn - 2 + yc * Math.tan(th * rad)
    items.push({ b, kind: 'spine', x: x0, w: sw(b), h: hp(b), y: 0, lean: -th, origin: 'l' })
    return x0 + sw(b) * Math.cos(th * rad)
  }
  const leanR = (b: SiteBook, xl: number, hn: number) => {
    const { yc } = leanRoom(sw(b), hp(b), hn, th)
    const x1 = xl + 2 - yc * Math.tan(th * rad)
    items.push({ b, kind: 'spine', x: x1 - sw(b), w: sw(b), h: hp(b), y: 0, lean: th, origin: 'r' })
    return x1 - sw(b) * Math.cos(th * rad)
  }
  const canLean = rest.length >= 2
  let width: number
  if (p === 0 || p === 2) {
    // P0 FACE · RUN · LEAN←   P2 RUN₁ · FACE · RUN₂ · LEAN←
    const up = canLean ? rest.slice(0, -1) : rest, ln = canLean ? rest.at(-1) : undefined
    let x: number
    if (p === 2 && up.length >= 2) {
      const m = Math.ceil(up.length / 2)
      x = run(up.slice(0, m), 0)
      face(x)
      x = run(up.slice(m), x + faceW(f, s, z))
    } else {
      face(0)
      x = run(up, faceW(f, s, z))
    }
    const last = items.filter((i) => i.kind === 'spine').at(-1)
    width = ln && last ? leanL(ln, x - 1, last.h) : x
  } else if (p === 1) {
    // P1 STACK · RUN · (gap) · FACE at the right end
    let x = stack.length ? stackAt(0) + 2 * z : 0
    x = run(rest, x)
    const need = x - 1 + GAP + faceW(f, s, z)
    face(Math.max(need, inner) - faceW(f, s, z))
    width = need
  } else {
    // P3 FACE · (gap) · LEAN→ · RUN · STACK at the right end
    const ln = canLean ? rest[0] : undefined, up = canLean ? rest.slice(1) : rest
    const L = stack.length ? Math.max(...stack.map(hp)) : 0
    const runW = up.reduce((a, b) => a + sw(b) + 1, 0) - 1
    const lr = ln ? leanRoom(sw(ln), hp(ln), hp(up[0]), th).room : 0
    const need = faceW(f, s, z) + GAP + lr + runW + (stack.length ? 2 * z + L : 0)
    const W = Math.max(need, inner)
    face(0)
    const xr = W - (stack.length ? L + 2 * z : 0) - runW
    if (stack.length) stackAt(W - L)
    run(up, xr)
    if (ln) leanR(ln, xr, hp(up[0]))
    width = need
  }
  return { items, width, height: Math.max(...[f, ...sp].map(hp)) + 40 * z, p }
}

/** greedy rows, newest first. Row i gets its pattern when it starts (nextPattern); a book joins the row while the row
   is under its cap (9…13) and that pattern still fits `avail`. */
export function shelve(books: SiteBook[], s: number, z: number, avail: number) {
  const rows: SiteBook[][] = [], ps: Pattern[] = []
  for (const b of books) {
    const cur = rows.at(-1), p = ps.at(-1)
    if (cur && p !== undefined && cur.length < capOf(cur[0]) && rowOf([...cur, b], p, s, z, 0).width <= avail) cur.push(b)
    else {
      ps.push(nextPattern(ps, b))
      rows.push([b])
    }
  }
  return { rows, ps }
}
