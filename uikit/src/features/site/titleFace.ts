/* D38: the site front title in the book's Title font (prod src/render/coverTitleFace.ts `siteTitleFace`). The kit cover
   ships upright Lora only, so italic is synthesised as in the editor cover; `sans` keeps the site sans (`.ss .sd-it`). */
import type * as React from "react"

/** the cover's Title font (prod schema COVER_TITLE_FONTS; the kit editor select's Serif italic / Serif / Sans) */
export type TitleFontId = "serif-italic" | "serif" | "sans"
export type TitleFace = { family: string; style: "italic" | "normal"; weight: 400 }

const SERIF = '"Lora Variable", Lora, Georgia, serif'

/** the serif Title fonts' face; `sans` → none (the site sans). A book without one has the kit default, Serif italic. */
export function titleFace(f: TitleFontId = "serif-italic"): TitleFace | undefined {
  return f === "sans" ? undefined : { family: SERIF, style: f === "serif-italic" ? "italic" : "normal", weight: 400 }
}

/** `titleFace` as inline style over `.ss .sd-it` */
export function titleStyle(f?: TitleFontId): React.CSSProperties {
  const t = titleFace(f)
  return t ? { fontFamily: t.family, fontStyle: t.style, fontWeight: t.weight } : {}
}
