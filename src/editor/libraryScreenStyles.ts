/** Kit empty-library motion + layout (injected so patch-coverage stays on TS). */

const STYLE_TEXT = `
@keyframes pb-lib-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}
.pb-library {
  background: var(--app);
  color: var(--foreground);
}
.pb-library-main {
  background: radial-gradient(1200px 800px at 50% 30%, #D6D6D6, #C8CACB 75%);
}
.pb-lib-rise {
  animation: pb-lib-rise 1s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.pb-lib-rise--d15 { animation-delay: 0.15s; }
.pb-library .pb-button.pb-lib-create {
  height: calc(var(--spacing) * 12);
  border-radius: var(--radius-full);
  padding-inline: calc(var(--spacing) * 7);
  font-size: var(--text-md);
  box-shadow: var(--shadow-ink);
}
.pb-library .pb-button.pb-lib-create-sm {
  height: calc(var(--spacing) * 10);
  border-radius: var(--radius-full);
  padding-inline: calc(var(--spacing) * 6);
  font-size: var(--text-base);
  box-shadow: var(--shadow-ink-sm);
}
.pb-button.pb-lib-change[data-hovered] {
  background: var(--field);
  color: var(--foreground);
}
.pb-library-headline {
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
  font-size: clamp(44px, 4vw, 64px);
  line-height: 0.98;
  letter-spacing: -0.035em;
}
.pb-library-heading {
  margin: 0; /* kit uses a margin-free h2 (library.tsx:238); a UA h1 margin pushed the page ~40px down */
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
  font-size: var(--text-display);
  line-height: 1;
  letter-spacing: -0.025em;
}
.pb-book-object-title {
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
}
.pb-book-object-title em {
  font-style: italic;
}
.pb-lib-quiet {
  height: calc(var(--spacing) * 9);
  border-radius: var(--radius-full);
  background: #D7D7D7;
  font-size: var(--text-sm);
  color: var(--foreground);
  border: 0;
  font-family: inherit;
  outline: none;
  transition: background-color 0.15s ease;
}
.pb-lib-quiet input {
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  background: transparent;
}
.pb-lib-quiet:hover,
.pb-lib-quiet[data-hovered] {
  background: var(--accent);
}
/* kit demo-parts/library.tsx:53-54 — rename Input (h-7 px-2 py-2 rounded-md bg-field, focus ring-2 ring-offset-2) */
.pb-lib-rename {
  box-sizing: border-box;
  width: 100%;
  height: calc(var(--spacing) * 7);
  margin: 0;
  padding: calc(var(--spacing) * 2);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--field);
  color: var(--foreground);
  font-family: inherit;
  font-size: var(--text-sm);
  outline: none;
}
.pb-lib-rename:focus {
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
}
.pb-lib-book {
  background: none;
  border: 0;
  padding: 0;
  outline: none;
}
.pb-lib-book .pb-lib-obj {
  transition: filter 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.pb-lib-book:hover .pb-lib-obj {
  filter: drop-shadow(0 18px 18px rgb(35 34 35 / 0.28));
}
.pb-lib-book:hover .pb-lib-floor {
  opacity: 1;
}
.pb-lib-floor {
  opacity: 0;
  transition: opacity 0.35s;
}
.pb-lib-book:focus-visible .pb-lib-obj {
  outline: 2px solid #3A3839;
  outline-offset: 4px;
  border-radius: 4px;
}
.pb-lib-book-menu {
  opacity: 0;
}
.group:hover .pb-lib-book-menu,
.pb-lib-book-menu[data-focus-visible],
.pb-lib-book-menu[aria-expanded='true'] {
  opacity: 1;
}
.pb-lib-book-actions .pb-menu-item:not([data-variant='destructive']) svg {
  color: var(--muted-foreground);
}
.pb-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  column-gap: 2.5rem;
  row-gap: 0.5rem;
}
@media (prefers-reduced-motion: reduce) {
  .pb-lib-rise { animation: none !important; }
  .pb-lib-book .pb-lib-obj,
  .pb-lib-floor { transition: none; }
}
`

/** Idempotent inject for library kit chrome. */
export function ensureLibraryScreenStyles(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (document.querySelector('style[data-pb-library]')) {
    return
  }
  const el = document.createElement('style')
  el.setAttribute('data-pb-library', '1')
  el.textContent = STYLE_TEXT
  document.head.appendChild(el)
}
