import type { FeatureDef } from "./types"
import { PAGES } from "./pages"

/** slug (roadmap item slug, see src/kit/pages.json) → demo + UX notes. Stage 3: all pages live in ./pages (demo-parts only). */
export const FEATURES: Record<string, FeatureDef> = PAGES
