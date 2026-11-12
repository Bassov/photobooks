/*
 * The bookcase shelf layout (Designer personal-site P4; port of the kit's
 * `features/site/shelf.ts`, Spec site-stand-v3 B2, D13, site-stand-v7 D30).
 * Pure: books → rows of items in case px. Units: `s` px per cm (already
 * × z), `z` the case scale (≥ 1).
 */
import type { SiteCatalogBook } from './siteInput'

/** What the shelf reads of a book. */
export interface ShelfBook {
  id: string
  title: string
  year: number
  /** printed pages */
  pages: number
  /** trim, cm */
  w: number
  h: number
  cloth: string
  ink: string
}

export const shelfBook = (b: SiteCatalogBook): ShelfBook => ({
  id: b.id,
  title: b.title,
  year: b.year,
  pages: b.pageCount,
  w: b.trimMm.w / 10,
  h: b.trimMm.h / 10,
  cloth: b.spine.cloth,
  ink: b.spine.ink,
})

/** lean angles (deg), picked by hash */
const THETA = [10, 11, 12, 13, 14] as const
/** FNV-1a 32 + a murmur3 finaliser (ids like book-13, book-14 must not give periodic patterns) */
export function hash(id: string): number {
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
/** the GL book's thickness: the pages plus two endpapers */
export const thickCm = (b: ShelfBook): number => 0.6 + ((b.pages + 2) / 2) * 0.1
export const spineW = (b: ShelfBook, s: number, z: number): number =>
  Math.max(24 * z, thickCm(b) * 2.4 * s)
export const faceW = (b: ShelfBook, s: number, z: number): number =>
  b.w * s + 8 * z

/** P0 face · run · lean←, P1 stack · run · gap · face, P2 run · face · run · lean←, P3 face · gap · lean→ · run · stack */
export type Pattern = 0 | 1 | 2 | 3
export interface Item {
  b: ShelfBook
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
export interface Row {
  items: Item[]
  width: number
  height: number
  p: Pattern
}

/**
 * Pattern of the shelf that starts with book `first`: shelf 0 → P0; then
 * one used by neither of the two shelves above, picked by hash(first id).
 */
export function nextPattern(ps: readonly Pattern[], first: ShelfBook): Pattern {
  if (ps.length === 0) return 0
  const c = ([0, 1, 2, 3] as const).filter((p) => !ps.slice(-2).includes(p))
  return c[hash(first.id) % c.length] ?? 0
}
/** books per shelf: 9…13 from the hash of the shelf's first (newest) book */
export const capOf = (first: ShelfBook): number => 9 + (hash(first.id) % 5)

/** a spine (w, h) resting on its neighbour (top hn) at θ: the horizontal room it takes past the neighbour */
export function leanRoom(
  w: number,
  h: number,
  hn: number,
  th: number,
): { yc: number; room: number } {
  const yc = Math.min(hn, h * Math.cos(th * rad))
  return { yc, room: yc * Math.tan(th * rad) - 2 + w * Math.cos(th * rad) }
}

const maxOf = (values: number[]): number => Math.max(...values)

/** One row; `inner` = the bay width free for the row (P1 puts the face at its right end, P3 right-aligns run + stack). */
export function rowOf(
  r: readonly ShelfBook[],
  p: Pattern,
  s: number,
  z: number,
  inner: number,
): Row {
  const sw = (b: ShelfBook) => spineW(b, s, z)
  const hp = (b: ShelfBook) => b.h * s
  const [f, ...sp] = r
  if (f === undefined) return { items: [], width: 0, height: 0, p }
  const stack =
    (p === 1 || p === 3) && sp.length >= 5
      ? [...sp]
          .sort((a, b) => sw(a) - sw(b))
          .slice(0, 2)
          .reverse()
      : []
  const rest = sp.filter((b) => !stack.includes(b))
  const th = THETA[hash(f.id) % THETA.length] ?? THETA[0]
  const items: Item[] = []
  const GAP = 24 * z
  const fw = faceW(f, s, z)
  const face = (x: number) =>
    items.push({ b: f, kind: 'face', x, w: fw, h: hp(f), y: 0, lean: 0 })
  const run = (bs: readonly ShelfBook[], x0: number) => {
    let x = x0
    for (const b of bs) {
      items.push({ b, kind: 'spine', x, w: sw(b), h: hp(b), y: 0, lean: 0 })
      x += sw(b) + 1
    }
    return x
  }
  const stackL = stack.length > 0 ? maxOf(stack.map(hp)) : 0
  const stackAt = (x: number) => {
    let y = 0
    for (const b of stack) {
      items.push({ b, kind: 'flat', x, w: hp(b), h: sw(b), y, lean: 0 })
      y += sw(b)
    }
    return x + stackL
  }
  const leanL = (b: ShelfBook, xn: number, hn: number) => {
    const { yc } = leanRoom(sw(b), hp(b), hn, th)
    const x0 = xn - 2 + yc * Math.tan(th * rad)
    items.push({
      b,
      kind: 'spine',
      x: x0,
      w: sw(b),
      h: hp(b),
      y: 0,
      lean: -th,
      origin: 'l',
    })
    return x0 + sw(b) * Math.cos(th * rad)
  }
  const leanR = (b: ShelfBook, xl: number, hn: number) => {
    const { yc } = leanRoom(sw(b), hp(b), hn, th)
    const x1 = xl + 2 - yc * Math.tan(th * rad)
    items.push({
      b,
      kind: 'spine',
      x: x1 - sw(b),
      w: sw(b),
      h: hp(b),
      y: 0,
      lean: th,
      origin: 'r',
    })
  }
  const canLean = rest.length >= 2
  let width: number
  if (p === 0 || p === 2) {
    // P0 FACE · RUN · LEAN←   P2 RUN₁ · FACE · RUN₂ · LEAN←
    const up = canLean ? rest.slice(0, -1) : rest
    const ln = canLean ? rest.at(-1) : undefined
    let x: number
    if (p === 2 && up.length >= 2) {
      const m = Math.ceil(up.length / 2)
      x = run(up.slice(0, m), 0)
      face(x)
      x = run(up.slice(m), x + fw)
    } else {
      face(0)
      x = run(up, fw)
    }
    const last = items.filter((i) => i.kind === 'spine').at(-1)
    width =
      ln !== undefined && last !== undefined ? leanL(ln, x - 1, last.h) : x
  } else if (p === 1) {
    // P1 STACK · RUN · (gap) · FACE at the right end
    const x = run(rest, stack.length > 0 ? stackAt(0) + 2 * z : 0)
    const need = x - 1 + GAP + fw
    face(Math.max(need, inner) - fw)
    width = need
  } else {
    // P3 FACE · (gap) · LEAN→ · RUN · STACK at the right end
    const ln = canLean ? rest[0] : undefined
    const up = canLean ? rest.slice(1) : rest
    const runW = up.reduce((a, b) => a + sw(b) + 1, 0) - 1
    const next = up[0]
    const lr =
      ln !== undefined && next !== undefined
        ? leanRoom(sw(ln), hp(ln), hp(next), th).room
        : 0
    const need = fw + GAP + lr + runW + (stack.length > 0 ? 2 * z + stackL : 0)
    const W = Math.max(need, inner)
    face(0)
    const xr = W - (stack.length > 0 ? stackL + 2 * z : 0) - runW
    if (stack.length > 0) stackAt(W - stackL)
    run(up, xr)
    if (ln !== undefined && next !== undefined) leanR(ln, xr, hp(next))
    width = need
  }
  return { items, width, height: maxOf(r.map(hp)) + 40 * z, p }
}

/** case frame (px at z = 1): sides, top, shelf, plinth; the row padding inside a bay */
export const SIDE = 18
export const TOP = 18
const SHELF = 16
export const PLINTH = 40
export const PAD = 12
/** desktop lead height for the fit: two 24/31.2 lines */
const LEAD_H = 62.4
/** the phone layout up to this width (D32) */
const PHONE_MAX = 640

export interface CaseLayout {
  phone: boolean
  /** case scale */
  z: number
  /** px per cm */
  s: number
  width: number
  height: number
  /** each row's top inside the case and its items, x from the bay's left */
  rows: (Row & { top: number })[]
}

/**
 * The case for a `vw` × `vh` page (kit `home.tsx`, D17 / D30 / D32): span 10
 * of the grid (≤ 1430) at one scale z = Z…14/9 so one shelf fills the page
 * under the lead; phone: between the margins at z = 1, `s` shrunk until the
 * widest face-out and two spines fit.
 */
export function caseLayout(
  books: readonly ShelfBook[],
  vw: number,
  vh: number,
): CaseLayout {
  const phone = vw <= PHONE_MAX
  const k = Math.min(1, vh / 900)
  const Z = phone ? 1 : Math.min(Math.max(((vh / 900) * 4) / 3, 1), 14 / 9)
  const span10 = ((vw - 48 - 11 * 16) / 12) * 10 + 9 * 16
  const width = phone ? vw - 32 : Math.min(span10, 1430)
  let s0 = 9 * k
  const H1 = TOP + Math.max(30, ...books.map((b) => b.h)) * s0 + 40 + PLINTH
  const z = phone
    ? 1
    : Math.min(Math.max((vh - 104 - LEAD_H - 40 - 72) / H1, Z), 14 / 9)
  const avail = width / z - 2 * (SIDE + PAD)
  if (phone) {
    const widest = (sc: number) =>
      Math.max(...books.map((b) => faceW(b, sc, 1)))
    while (s0 > 4 && widest(s0) + 50 > avail) s0 *= 0.96
  }
  const { rows: groups, ps } = shelve(books, s0, 1, avail)
  const s = s0 * z
  const inner = width - 2 * (SIDE + PAD) * z
  let top = TOP * z
  const rows = groups.map((r, i) => {
    const p = ps[i] ?? 0
    const row = rowOf(r, p, s, z, phone ? inner : 0)
    const off = phone ? 0 : (inner - row.width) / 2
    const at = top
    top += row.height + SHELF * z
    return {
      ...row,
      top: at,
      items: row.items.map((it) => ({ ...it, x: it.x + off })),
    }
  })
  const height =
    (TOP + (rows.length - 1) * SHELF + PLINTH) * z +
    rows.reduce((a, r) => a + r.height, 0)
  return { phone, z, s, width, height, rows }
}

/**
 * Greedy rows, newest first: row i gets its pattern when it starts; a book
 * joins the row while the row is under its cap (9…13) and still fits `avail`.
 */
export function shelve(
  books: readonly ShelfBook[],
  s: number,
  z: number,
  avail: number,
): { rows: ShelfBook[][]; ps: Pattern[] } {
  const rows: ShelfBook[][] = []
  const ps: Pattern[] = []
  for (const b of books) {
    const cur = rows.at(-1)
    const p = ps.at(-1)
    const head = cur?.[0]
    if (
      cur !== undefined &&
      p !== undefined &&
      head !== undefined &&
      cur.length < capOf(head) &&
      rowOf([...cur, b], p, s, z, 0).width <= avail
    ) {
      cur.push(b)
    } else {
      ps.push(nextPattern(ps, b))
      rows.push([b])
    }
  }
  return { rows, ps }
}
