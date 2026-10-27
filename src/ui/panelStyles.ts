/** Panel + splitter chrome (injected so patch-coverage stays on TS). */

const STYLE_TEXT = `
.pb-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--chrome);
}
.pb-panel__header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
}
.pb-panel__title {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.pb-panel__body {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
}
.pb-splitter {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  width: 8px;
  margin: 0 -4px;
  cursor: ew-resize;
  touch-action: none;
}
.pb-splitter::after {
  content: '';
  position: absolute;
  inset: 0 auto;
  left: 50%;
  width: 1px;
  background: transparent;
  transition: background-color 0.12s;
}
.pb-splitter:hover::after,
.pb-splitter:focus-visible,
.pb-splitter[data-dragging='true']::after {
  background: var(--ring);
}
.pb-splitter:focus-visible {
  outline: none;
}
.pb-splitter:focus-visible::after {
  background: var(--ring);
}
.specimen-panels-demo {
  display: flex;
  height: 12rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--canvas);
}
.specimen-panels-pane {
  flex-shrink: 0;
  min-width: 0;
}
`

/** Idempotent inject for Panel / PanelSplitter / specimen demo styles. */
export function ensurePanelStyles(): void {
  if (document.querySelector('style[data-pb-panel]')) {
    return
  }
  const el = document.createElement('style')
  el.setAttribute('data-pb-panel', '1')
  el.textContent = STYLE_TEXT
  document.head.appendChild(el)
}
