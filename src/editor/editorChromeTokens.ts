/** Kit Theme B chrome surfaces (v0.9.3) — copy of uikit sandbox tokens, not an import. */

export const T = '#393738'
export const SUB = '#535152'
const ON_INK = '#F2F2F2'
export const BAR = '#E1E1E1'
export const FIELD = '#D7D7D7'
const SEL = '#CACACA'
/** Owner 2026-10-29: toggle on / off fills and the swatch selection ring (2px, 2px offset). */
export const TOGGLE_ON = '#A8A8A8'
export const TOGGLE_OFF = '#CACACA'
export const SWATCH_RING = '#8E8E8E'

export {
  bookSettingsSubtitle,
  fmtN,
  mmToCm,
  PAGE_MAX,
  PAGE_MIN,
  pageLabel,
  pagesNote,
  pagesOf,
} from './editorChromePanels'

export const EDITOR_CHROME_CSS = `
.e7 { --grid-line: rgb(83 81 82 / .6); --grid-fill: rgb(83 81 82 / .10); --toggle-on: ${TOGGLE_ON}; --toggle-off: ${TOGGLE_OFF}; --swatch-ring: ${SWATCH_RING} }
.snap-label { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); padding: 2px 8px; border-radius: 9999px; background: ${FIELD}; color: ${T}; font-size: 11px; white-space: nowrap }
.frame-draft { position: absolute; z-index: 5000; pointer-events: none; outline: 1.5px dashed ${SUB}; outline-offset: -1px; background: rgb(83 81 82 / .08) }
.snap-line { position: absolute; z-index: 5001; pointer-events: none; background: ${T} }
.snap-line[data-axis=x] { top: -10px; bottom: -10px; width: 1.5px; transform: translateX(-.75px) }
.snap-line[data-axis=y] { left: -10px; right: -10px; height: 1.5px; transform: translateY(-.75px) }
.snap-line-label { position: absolute; padding: 1px 6px; border-radius: 4px; background: ${FIELD}; color: ${T}; font-size: 11px; font-weight: 600; white-space: nowrap }
.snap-line[data-axis=x] .snap-line-label { left: 4px; top: -22px }
.snap-line[data-axis=y] .snap-line-label { left: -8px; top: 3px; transform: translateX(-100%) }
.e7-ghost { color: ${T}; border: 0; outline: none; transition: background-color .15s; background: transparent; cursor: pointer }
.e7-ghost:hover { background: rgb(57 55 56/.08) }
.e7-ghost:focus-visible, .e7-item:focus-visible, .e7-title:focus-visible, .e7-canvas:focus-visible { outline: 2px solid #535152; outline-offset: 2px }
.e7-canvas[data-panning], .e7-canvas[data-panning]:focus-visible { outline: none }
.e7-canvas[data-panning] .pasteboard-scroll { cursor: grab }
.e7-canvas[data-panning] .pasteboard-scroll:active { cursor: grabbing }
.e7-canvas[data-panning] button.spread-frame[aria-pressed=true]:focus-visible::after { content: none; box-shadow: none; outline: none }
.cursor-tool-frame { cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M12%201v22M1%2012h22%22%20stroke%3D%22%23232223%22%20stroke-width%3D%223.2%22%20stroke-linecap%3D%22square%22%2F%3E%3Cpath%20d%3D%22M12%201v22M1%2012h22%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22square%22%2F%3E%3C%2Fsvg%3E") 12 12, crosshair }
.cursor-tool-text { cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2224%22%20viewBox%3D%220%200%2016%2024%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M3%202.5h10M8%202.5v19M3%2021.5h10%22%20stroke%3D%22%23232223%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22square%22%2F%3E%3Cpath%20d%3D%22M3%202.5h10M8%202.5v19M3%2021.5h10%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22square%22%2F%3E%3C%2Fsvg%3E") 7 11, text }
.e7-canvas.cursor-grab .pasteboard-scroll { cursor: grab }
.e7-canvas.cursor-grab .pasteboard-scroll:active, .e7-canvas.cursor-grab .pasteboard-scroll:active * { cursor: grabbing }
.e7-canvas.cursor-tool-frame .pasteboard-scroll *, .e7-canvas.cursor-tool-text .pasteboard-scroll *, .e7-canvas.cursor-grab .pasteboard-scroll * { cursor: inherit }
.e7-item { cursor: default; outline: none; transition: background-color .12s; border: 0; background: transparent; width: 100%; text-align: left }
.e7-item:hover { background: ${FIELD} }
.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: ${SEL} }
.filmstrip-item { box-shadow: none }
.filmstrip-item::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgb(0 0 0/.08); pointer-events: none }
.filmstrip-item[aria-selected=true] { background: ${SEL} }
.filmstrip-item[aria-selected=true][data-focused] { background: ${SEL}; box-shadow: 0 0 0 2px #535152 }
.filmstrip-placed { border-radius: 9999px; background: rgb(0 0 0/.55); color: #fff }
.filmstrip-placed svg { stroke-width: 3 }
.film-chip { color: ${SUB}; background: transparent; border: 0; border-radius: var(--radius-md); height: 28px; padding: 0 8px; font-size: var(--text-xs); box-shadow: none; transition: background-color .12s }
.film-chip:hover, .film-chip[data-hovered], .film-chip[data-selected] { background: ${FIELD}; color: ${T} }
.film-chip:focus-visible { outline: 2px solid #535152; outline-offset: 2px }
.film-chip.film-add-folder { color: ${T}; font-weight: 500; padding: 0 10px }
.film-chip.film-add-folder[data-disabled] { opacity: .5 }
.pb-segmented__segment input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer }
.pb-segmented__segment input:disabled { cursor: wait }
.e7-title { transition: background-color .12s; border: 0; background: transparent; cursor: pointer }
.e7-title:hover { background: rgb(57 55 56/.08) }
.e7-title:active { background: #CDCDCD }
.e7-tog[aria-expanded=true] { background: ${FIELD} }
.e7-pan { transition: width .18s cubic-bezier(.2,.7,.2,1), height .18s cubic-bezier(.2,.7,.2,1) }
@media (prefers-reduced-motion: reduce) { .e7-pan { transition: none } }
.e7-tip { position: relative }
.e7-tip > .e7-tt { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .12s .25s; z-index: 50; background: #535152; color: ${ON_INK}; font-size: 11px; line-height: 16px; padding: 3px 7px; border-radius: 5px }
.e7-tip:hover > .e7-tt, .e7-tip:focus-visible > .e7-tt { opacity: 1 }
.e7-tt kbd { font-family: inherit; opacity: .7; margin-left: 6px }
.e7.editor-shell { display: flex; flex-direction: column; height: 100svh; max-height: 100svh; overflow: hidden; background: var(--canvas) }
.e7 .editor-chrome { flex-wrap: wrap; gap: calc(var(--spacing) * 2) calc(var(--spacing) * 1.5); padding: 0 calc(var(--spacing) * 3); border-bottom: 0; min-height: 3rem; height: auto; flex-shrink: 0 }
.e7 .editor-workspace { display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; height: auto; overflow: hidden }
.e7 .pasteboard { flex: 1 1 0; min-height: 0; height: auto }
.editor-panel-l { width: 0 }
.editor-panel-l[data-open='true'] { width: var(--panel-left, 188px) }
.editor-panel-l-inner { width: var(--panel-left, 188px) }
.editor-panel-r { width: 0 }
.editor-panel-r[data-open='true'] { width: var(--panel-right, 300px) }
.editor-inspector { width: var(--panel-right, 300px); background: ${BAR}; color: ${T}; border: 0; outline: 0; box-shadow: none }
.e7:has([data-dragging='true']) .e7-pan { transition: none }
.editor-panel-b[data-open='false'] { height: 0 }
.editor-canvas-inner { background: transparent }
.editor-dock { background: ${BAR} }
.editor-dock-meta { color: ${SUB} }
.filmstrip-empty, .filmstrip-empty * { color: ${SUB} }
.editor-spreads { background: var(--chrome); color: var(--foreground) }
.editor-spreads-mode { background: var(--chrome); color: var(--foreground); box-shadow: var(--shadow-sm) }
.editor-spread-thumb { overflow: hidden; border-radius: var(--spread-card-radius); box-shadow: var(--spread-card-shadow) }
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
