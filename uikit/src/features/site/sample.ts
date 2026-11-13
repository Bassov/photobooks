/* Personal site sample data (stand site-demo-1/data.ts, personal-site K1): six books with the Designer Spec site-awards
   object data (true size in cm, page count, spine colours). */
import { P } from "@/data"
import { hiPhoto, type Fmt } from "../library"

export const AUTHOR = "Aleksandr Basov"
export const EMAIL = "hello@aleksandr.photos"

/** Settings → Site (personal-site D37, site-settings S1/S5): the site title, the author, the intro (the home lead) and
 *  the whole site's look */
export type SiteTexts = { title: string; author: string; intro: string; theme: "light" | "dark" }
export const SAMPLE_SITE_TEXTS: SiteTexts = {
  title: "Aleksandr’s photobooks",
  author: AUTHOR,
  intro: "Photographs of lakes, coasts and the people I travel with, made into books.",
  theme: "light",
}
/** D37: the lead is the intro, else "Photobooks by {author}.", else none */
export const siteLead = ({ intro, author }: Pick<SiteTexts, "intro" | "author">): string | null =>
  intro.trim() || (author.trim() ? `Photobooks by ${author.trim()}.` : null)

export type SiteBook = {
  id: string; title: string; year: number; fmt: Fmt; cover: string; ink: string; place?: "top" | "bottom"
  /** true size, cm */
  w: number; h: number
  spine: string; spineInk: string
  /** `*…*` marks the italic phrase */
  statement: string
  spreads: { template: string; photos: string[] }[]
  /** the page count when it isn't the sample's (cover + spreads) · 2: a #/demo book has 2(n − 1) (D38) */
  pages?: number
}
/** "t-full p10 · t-pair p03 p18 · … · last hi/r7" → interior spreads (index 1…) */
const sp = (s: string) => s.split(" · ").map((x) => { const [template, ...photos] = x.split(" "); return { template, photos } })
export const BOOKS: SiteBook[] = [
  { id: "lake-trip", title: "Lake trip", year: 2026, fmt: "portrait", w: 24, h: 30, cover: "p01", ink: "#fff", place: "bottom", spine: "#1E4B57", spineInk: "#EAF2F2",
    statement: "Ten days around the mountain lakes in late September: *the water, the roads between,* and the two of us.",
    spreads: sp("t-full p10 · t-pair p03 p18 · t-hero2 p01 p16 p07 · t-margin p13 · t-pano p17 · t-offset p11 p09 · t-hero4 p15 p05 p14 p06 p19 · t-full p08 · t-three p12 p20 p04 · last hi/r7") },
  { id: "coast", title: "Coast", year: 2025, fmt: "landscape", w: 30, h: 24, cover: "p19", ink: "#2E2C2D", spine: "#CBD5DA", spineInk: "#2E2C2D",
    statement: "A summer of short trips to the sea: sand, wind and *the long light of the evenings.*",
    spreads: sp("t-full p19 · t-margin p11 · t-offset p13 p16 · t-hero2 p09 p07 p14 · t-full hi/r2 · last p05") },
  { id: "summer-family", title: "Summer, family", year: 2025, fmt: "square", w: 25, h: 25, cover: "p15", ink: "#fff", spine: "#D9C6A3", spineInk: "#3A3127",
    statement: "The family summer: a house by the water, grandparents, children and *a lot of ice cream.*",
    spreads: sp("t-full p15 · t-three p12 p20 p03 · t-hero4 p13 p05 p14 p06 p19 · t-margin p07 · last p11") },
  { id: "desert-road", title: "Desert road", year: 2024, fmt: "landscape", w: 30, h: 24, cover: "p08", ink: "#fff", spine: "#2D5F69", spineInk: "#EAF2F2",
    statement: "Two thousand kilometres of empty road, *and what stood beside it.*",
    spreads: sp("t-full p08 · t-margin p17 · t-hero2 p16 p06 p01 · t-pano hi/x-valley · last p09") },
  { id: "forest", title: "Forest", year: 2024, fmt: "portrait", w: 24, h: 30, cover: "p18", ink: "#fff", spine: "#2F4A2C", spineInk: "#E8EFE4",
    statement: "Walks in the same forest through one year, *from the first fog to the first snow.*",
    spreads: sp("t-full p10 · t-pair p18 p03 · t-margin hi/c13 · t-full hi/c25 · last hi/c18") },
  { id: "city", title: "City", year: 2023, fmt: "square", w: 25, h: 25, cover: "p04", ink: "#fff", spine: "#6B7F98", spineInk: "#F1F3F6",
    statement: "Rooftops, cafés and streets of one old town, *over three short visits.*",
    spreads: sp("t-pano p04 · t-hero2 p07 p05 p14 · t-full p17 · t-offset p06 p13 · t-margin p16 · last p12") },
]
/** a photo id's URL; "" for an empty frame or an unknown id (a #/demo book may have both) */
export const src = (id: string): string => {
  if (id.startsWith("hi/")) return hiPhoto(id.slice(3))
  const p: { src: string } | undefined = P(id)
  return p?.src ?? ""
}
/** cover + interior spreads, two pages each */
export const pagesOf = (b: SiteBook) => b.pages ?? (b.spreads.length + 1) * 2
/** spread width / height: two pages of the format */
export const SPREAD_R: Record<Fmt, number> = { portrait: 1.6, landscape: 2.5, square: 2 }
export const sizeOf = (b: SiteBook) => `${b.w} × ${b.h} cm`
export const pad2 = (n: number) => String(n).padStart(2, "0")
export const metaOf = (b: SiteBook) => `${b.year} · ${pagesOf(b)} pages · ${sizeOf(b)}`
/** reader views: 0 cover, 1 endpaper | page 1, 2… the spreads (the last one: last page | endpaper), then the back cover */
export const viewsOf = (b: SiteBook) => b.spreads.length + 3
export const viewLabel = (b: SiteBook, v: number) => {
  const n = viewsOf(b)
  if (v <= 0) return "Cover"
  if (v >= n - 1) return "Back cover"
  if (v === 1) return "Page 1"
  const k = v - 1
  return b.spreads[k - 1].template === "last" ? `Page ${2 * k}` : `Pages ${2 * k}–${2 * k + 1}`
}
/** "Ten days *the water* …" → text with <em> parts */
export const italics = (s: string) => s.split("*").map((x, i) => ({ t: x, it: i % 2 === 1 }))
