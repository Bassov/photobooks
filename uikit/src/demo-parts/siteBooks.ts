/* D38 (Designer personal-site, K2): the #/demo session's books → the personal site's books (`SiteBook`,
   features/site/sample). No imports, structural types: the Node unit test (e2e/kit-personal-site-books.spec.ts) loads
   this file as it is. */

/** the parts of a session book (`DBook`) the site reads */
export type SessionBookIn = {
  id: string; title: string
  /** trim size, cm */
  book: { w: number; h: number }
  doc?: { spreads: { template: string | null; frames: { kind: "image" | "text"; photo: string | null }[] }[] } | undefined
  extras?: { cover?: string } | undefined
}
/** = `SiteBook` (sample.ts) */
export type SiteBookOut = {
  id: string; title: string; year: number; fmt: "portrait" | "landscape" | "square"; cover: string; ink: string
  w: number; h: number; spine: string; spineInk: string; statement: string; pages: number
  spreads: { template: string; photos: string[] }[]
}

/** the kit cover's cloth (sandbox CoverSpread spine) */
export const CLOTH = "#353332"
/** relative luminance 0…1 of `#rrggbb` */
export const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0)
}
/** the stand's spine ink: light on a dark cloth (luminance < 0.23) */
export const spineInkOf = (cloth: string) => (luminance(cloth) < 0.23 ? "#F1F3F6" : "#2E2C2D")

type SpreadIn = NonNullable<SessionBookIn["doc"]>["spreads"][number]
const photosOf = (s: SpreadIn) => s.frames.filter((f) => f.kind === "image").map((f) => f.photo ?? "")

/** One session book: size in cm, the UTC `year`, 2(n − 1) pages; spreads 1…n − 1 of the doc (spread 0 is the site's
   title page), the last one a single left page; a template the site doesn't know becomes `t-full` with the first photo. */
export function siteBookOf(x: SessionBookIn, { year, templates }: { year: number; templates: readonly string[] }): SiteBookOut {
  const spreads = x.doc?.spreads ?? [], n = spreads.length
  const first = (s: SpreadIn) => photosOf(s).find(Boolean) ?? ""
  const cover = x.extras?.cover || spreads.map(first).find(Boolean) || ""
  const { w, h } = x.book
  return {
    id: x.id, title: x.title, year, fmt: w === h ? "square" : w > h ? "landscape" : "portrait", cover, ink: "#fff", w, h,
    spine: CLOTH, spineInk: spineInkOf(CLOTH), statement: "", pages: Math.max(0, 2 * (n - 1)),
    spreads: spreads.slice(1).map((s, i) => {
      if (i === n - 2) return { template: "last", photos: [first(s)] }
      return s.template && templates.includes(s.template) ? { template: s.template, photos: photosOf(s) } : { template: "t-full", photos: [first(s)] }
    }),
  }
}

/** the published books, in session order */
export const siteBooksOf = (books: readonly (SessionBookIn & { published?: boolean })[], o: { year: number; templates: readonly string[] }) =>
  books.filter((b) => b.published).map((b) => siteBookOf(b, o))
