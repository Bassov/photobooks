## Proposal

Roadmap: `docs/roadmap/P1/thumb-reload-cache-miss.md` (SoT). UI ref: `uikit#/feature/editor-shell-filmstrip`.

### Scope out

- Background warm, bulk hydrate, hot-cache rewrite (sibling thumb items).
- Filmstrip windowing / visible sync.

### Delta / Risk

- No spec delta: `filmstrip` derived-cache + decode-priority contracts already cover it.
- e2e: scroll `filmstrip-scroll` to the tail → upright thumbs, 0 placeholders; no page-level H/V scroll.
- Security: Files only via granted registered `AssetSource`; worker decode; no new URL surface.
