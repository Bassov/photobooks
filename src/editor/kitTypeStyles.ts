/** Kit type parity for Welcome / Library / Settings (injected so patch-coverage stays on TS). */
import { BOOK_FONT_FACES, unicodeRangeCss } from '../fonts/bookFonts'

/**
 * Lora with upright faces only: the kit ships no Lora italic, so its `<em>`
 * display lines are Chrome's synthesized oblique (wider than true italic;
 * Welcome "for your books." 581 vs 546 px). Same woff2 files as the app.
 */
export const KIT_DISPLAY_FAMILY = 'Lora Upright'
export const KIT_DISPLAY_FONT = `'${KIT_DISPLAY_FAMILY}', var(--font-heading)`

function uprightLoraFaces(): string {
  return BOOK_FONT_FACES.filter(
    (f) => f.family === 'Lora Variable' && f.style === 'normal',
  )
    .map(
      (f) => `@font-face {
  font-family: '${KIT_DISPLAY_FAMILY}';
  font-style: normal;
  font-display: swap;
  font-weight: ${f.weightMin.toString()} ${f.weightMax.toString()};
  src: url('/fonts/${f.file}') format('woff2-variations');
  unicode-range: ${unicodeRangeCss(f)};
}`,
    )
    .join('\n')
}

/* Kit --text-xs/--text-sm line-heights (uikit index.css :137-138); the app keeps
   Tailwind's 16px / 18.57px, which drifts kit text blocks by 0.4–0.6px. */
const STYLE_TEXT = `${uprightLoraFaces()}
.pb-kit-type {
  --text-xs--line-height: 1.4;
  --text-sm--line-height: 1.45;
}
`

/** Idempotent inject for kit display font + type scope. */
export function ensureKitTypeStyles(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (document.querySelector('style[data-pb-kit-type]')) {
    return
  }
  const el = document.createElement('style')
  el.setAttribute('data-pb-kit-type', '1')
  el.textContent = STYLE_TEXT
  document.head.appendChild(el)
}
