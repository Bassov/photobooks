import type { ComponentType, ReactNode } from "react"

export type Notes = {
  what: ReactNode
  where: ReactNode
  /** optional; Stage 3 pages use what / where / edge only */
  why?: ReactNode
  keys?: [string, string][]
  edge?: ReactNode[]
}
/** A kit page: live demo + UX notes. Slug, title, group and kind live in src/kit/pages.json. */
export type FeatureDef = {
  Demo: ComponentType
  notes: Notes
  /** demo frame height in px (default 640) */
  h?: number
  /** demo frame grows with its content instead of a fixed height (static specimens) */
  auto?: boolean
}
