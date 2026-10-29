/* Kit screens = roadmap areas (src/kit/screens.json). Stage 3: each area shows its first feature page's demo and notes. */
import type * as React from "react"
import type { Notes } from "./types"
import { PAGES } from "./pages"
import SCREENS from "@/kit/screens.json"
import MANIFEST from "@/kit/pages.json"

export type ScreenDef = { Demo?: React.ComponentType; from?: string; notes: Notes; h?: number }
export const SCREEN_DEFS: Record<string, ScreenDef> = Object.fromEntries(SCREENS.map((s) => {
  const from = MANIFEST.find((p) => p.screen === s.id)!.slug
  return [s.id, { from, notes: PAGES[from].notes }]
}))
