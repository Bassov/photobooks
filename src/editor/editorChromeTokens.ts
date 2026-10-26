/** Kit Theme B chrome surfaces (v0.9.3) — copy of uikit sandbox tokens, not an import. */

export const T = '#393738'
export const SUB = '#535152'
const ON_INK = '#F2F2F2'
export const SURROUND = '#C8CACB'
export const BAR = '#E1E1E1'
export const FIELD = '#D7D7D7'
const SEL = '#CACACA'

export { fmtN, mmToCm, pageLabel, pagesOf } from './editorChromePanels'

export const EDITOR_CHROME_CSS = `
.e7 ::-webkit-scrollbar-thumb { background-color: #A8A8A8 }
.e7 *:hover::-webkit-scrollbar-thumb { background-color: #969696 }
.e7 ::-webkit-scrollbar-thumb:hover { background-color: #7E7E7E }
.e7-ghost { color: ${T}; border: 0; outline: none; transition: background-color .15s; background: transparent; cursor: pointer }
.e7-ghost:hover { background: rgb(57 55 56/.08) }
.e7-ghost:focus-visible, .e7-item:focus-visible, .e7-title:focus-visible, .e7-canvas:focus-visible { outline: 2px solid #535152; outline-offset: 2px }
.e7-canvas[data-panning], .e7-canvas[data-panning]:focus-visible { outline: none }
.e7-item { cursor: default; outline: none; transition: background-color .12s; border: 0; background: transparent; width: 100%; text-align: left }
.e7-item:hover { background: ${FIELD} }
.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: ${SEL} }
.e7-title { transition: background-color .12s; border: 0; background: transparent; cursor: pointer }
.e7-title:hover { background: rgb(57 55 56/.08) }
.e7-title:active { background: #CDCDCD }
.e7-tog[aria-pressed=true] { background: ${FIELD} }
.e7-sec:hover { background: #CDCDCD !important }
.e7-pan { transition: width .18s cubic-bezier(.2,.7,.2,1), height .18s cubic-bezier(.2,.7,.2,1) }
@media (prefers-reduced-motion: reduce) { .e7-pan { transition: none } }
.e7-tip { position: relative }
.e7-tip > .e7-tt { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .12s .25s; z-index: 50; background: #535152; color: ${ON_INK}; font-size: 11px; line-height: 16px; padding: 3px 7px; border-radius: 5px }
.e7-tip:hover > .e7-tt, .e7-tip:focus-visible > .e7-tt { opacity: 1 }
.e7-tt kbd { font-family: inherit; opacity: .7; margin-left: 6px }
`

const STYLE_ID = 'pb-editor-chrome-v93'
let injected = false

export function ensureEditorChromeStyles(): void {
  if (typeof document === 'undefined') return
  if (injected) return
  const existing = document.getElementById(STYLE_ID)
  if (existing) {
    injected = true
    return
  }
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = EDITOR_CHROME_CSS
  document.head.appendChild(el)
  injected = true
}

/** Test seam: reset inject flag between suites. */
export function resetEditorChromeStylesForTests(): void {
  injected = false
  document.getElementById(STYLE_ID)?.remove()
}
