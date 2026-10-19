import data from "./pages.json"

/** One kit page per roadmap item that has real UI/UX. `slug` is the roadmap item slug (docs/roadmap.md is the source of truth). */
export type PageKind = "interactive" | "static"
export type Page = { slug: string; title: string; group: string; kind: PageKind }

/** Flat list in roadmap order */
export const PAGES = data as Page[]
export const pageIndex = (slug: string) => PAGES.findIndex((p) => p.slug === slug)
/** Groups (milestone headings) in first-appearance order */
export const GROUPS: { name: string; pages: Page[] }[] = PAGES.reduce<{ name: string; pages: Page[] }[]>((acc, p) => {
  const last = acc[acc.length - 1]
  if (last && last.name === p.group) last.pages.push(p)
  else acc.push({ name: p.group, pages: [p] })
  return acc
}, [])
