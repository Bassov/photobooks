/** Kit Theme B chrome surfaces (v0.9.3) — copy of uikit sandbox tokens, not an import. */

export const T = '#393738'
export const SUB = '#535152'
const ON_INK = '#F2F2F2'
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
.e7-canvas[data-panning] .pasteboard-scroll { cursor: grab }
.e7-canvas[data-panning] .pasteboard-scroll:active { cursor: grabbing }
.e7-canvas[data-panning] button.spread-frame:focus-visible::after,
.e7-canvas[data-panning] button.spread-frame[aria-pressed=true]:focus-visible::after { content: none; box-shadow: none }
.e7-item { cursor: default; outline: none; transition: background-color .12s; border: 0; background: transparent; width: 100%; text-align: left }
.e7-item:hover { background: ${FIELD} }
.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: ${SEL} }
.filmstrip-item { box-shadow: none }
.filmstrip-item[aria-selected=true] { background: ${SEL} }
.filmstrip-item[aria-selected=true][data-focused] { background: ${SEL}; box-shadow: 0 0 0 2px #535152 }
.filmstrip-placed { --badge-fg: ${ON_INK}; --badge-bg: color-mix(in srgb, #232223 72%, transparent); --badge-ring: #232223; --badge-dot: ${ON_INK} }
.pb-segmented__segment { position: relative; padding: calc(var(--spacing) * 1) calc(var(--spacing) * 2); border-radius: var(--radius-sm); background: transparent; transition: background-color .12s }
.pb-segmented__segment--selected { background: ${SEL}; font-weight: 600 }
.pb-segmented__segment input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer }
.pb-segmented__segment input:disabled { cursor: wait }
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
.e7.editor-shell { display: flex; flex-direction: column; height: 100svh; max-height: 100svh; overflow: hidden; background: var(--canvas) }
.e7 .editor-chrome { flex-wrap: wrap; gap: calc(var(--spacing) * 2); padding: 0 calc(var(--spacing) * 3); border-bottom: 0; min-height: 3rem; height: auto; flex-shrink: 0 }
.e7 .editor-workspace { display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; height: auto; overflow: hidden }
.e7 .pasteboard { flex: 1 1 0; min-height: 0; height: auto }
.editor-panel-l { width: 0 }
.editor-panel-l[data-open='true'] { width: var(--panel-left, 212px) }
.editor-panel-l-inner { width: var(--panel-left, 212px) }
.editor-panel-r { width: 0 }
.editor-panel-r[data-open='true'] { width: var(--panel-right, 300px) }
.editor-inspector { width: var(--panel-right, 300px); background: var(--chrome) }
.e7:has([data-dragging='true']) .e7-pan { transition: none }
.editor-panel-b[data-open='false'] { height: 0 }
.editor-canvas-inner { background: transparent }
.editor-dock { background: var(--chrome) }
.editor-dock-meta { color: var(--muted-foreground) }
.editor-inspector-stub__title { color: var(--muted-foreground) }
.editor-inspector-stub__body { color: var(--foreground) }
.editor-spreads { background: var(--chrome); color: var(--foreground) }
.editor-spreads-mode { background: var(--chrome); color: var(--foreground); box-shadow: var(--shadow-sm) }
.editor-spread-thumb { height: var(--spreads-thumb-h, 64px); overflow: hidden; background: var(--paper); box-shadow: var(--shadow-sm) }
.editor-add-spread { height: 32px; color: var(--muted-foreground) }
`

const STYLE_ID = 'pb-editor-chrome-v93'

/** Inject kit chrome CSS once (idempotent). */
export function ensureEditorChromeStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = EDITOR_CHROME_CSS
  document.head.appendChild(el)
}

/** Test seam: remove injected style between suites. */
export function resetEditorChromeStylesForTests(): void {
  document.getElementById(STYLE_ID)?.remove()
}
