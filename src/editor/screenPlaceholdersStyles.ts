/** Placeholder screen layout (library / unsupported). Welcome uses WelcomeScreen.css. */

const STYLE_TEXT = `
.pb-screen {
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  max-height: 100vh;
  max-height: 100dvh;
  padding: calc(var(--spacing) * 6);
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4);
  background: var(--background);
  color: var(--foreground);
  overflow: hidden;
}
.pb-screen h1 {
  margin: 0;
  font-size: var(--text-2xl);
}
.pb-screen--unsupported {
  align-items: center;
  justify-content: center;
  text-align: center;
}
.pb-library-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 2);
  align-items: center;
}
.pb-library-folder {
  color: var(--muted-foreground);
  font-size: var(--text-sm);
}
.pb-library-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.pb-library-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}
.pb-library-list li {
  display: flex;
  gap: calc(var(--spacing) * 2);
  align-items: center;
  min-height: 2.75rem;
}
`

/** Idempotent inject for placeholder screens (keeps styles in covered TS). */
export function ensureScreenPlaceholderStyles(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (document.querySelector('style[data-pb-screen-placeholders]')) {
    return
  }
  const el = document.createElement('style')
  el.setAttribute('data-pb-screen-placeholders', '1')
  el.textContent = STYLE_TEXT
  document.head.appendChild(el)
}
