import data from "./pages.json"
import screenData from "./screens.json"

/** One kit page per roadmap item that has real UI/UX. `slug` is the roadmap item slug (docs/roadmap.md is the source of truth). */
export type PageKind = "interactive" | "static"
export type Page = { slug: string; title: string; group: string; kind: PageKind; screen: string }
/** An app screen: a full live demo plus the feature pages that live on it (kit v4). */
export type Screen = { id: string; title: string; summary: string }

/** Manifest list in roadmap order */
export const MANIFEST = data as Page[]
export const SCREENS = screenData as Screen[]
export const screenOf = (id: string) => SCREENS.find((s) => s.id === id)
export const screenIndex = (id: string) => SCREENS.findIndex((s) => s.id === id)
/** Features on a screen, in roadmap order */
export const featuresOn = (id: string) => MANIFEST.filter((p) => p.screen === id)
/** Kit reading order: screen by screen, roadmap order inside a screen. Prev / next and Alt+←/→ follow this. */
export const PAGES: Page[] = SCREENS.flatMap((s) => featuresOn(s.id))
export const pageIndex = (slug: string) => PAGES.findIndex((p) => p.slug === slug)
/** Milestones (secondary filter) in roadmap order */
export const MILESTONES: string[] = [...new Set(MANIFEST.map((p) => p.group))]
/** Screen groups for the index */
export const GROUPS: { screen: Screen; pages: Page[] }[] = SCREENS.map((s) => ({ screen: s, pages: featuresOn(s.id) }))
