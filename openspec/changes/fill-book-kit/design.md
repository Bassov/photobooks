## Decisions

1. Kit model (`store.tsx`): pure `planFillBook` / `fillBook` mirror core `fill.ts`. E = unlocked image frames without
   photo or `overrides` on every spread, read left page → right page → top (1 mm) → left. L = ∅ (the kit last page has no
   frames), so new spreads (`spread(bestTemplate(chunk).id, chunk)`, chunks of 2) append at index n. One `st.update`.
2. Input = `sortedGallery(gallery, sort)` minus placed (`withCover(placedSet)`, as the filmstrip) minus `st.missing`.
3. Page max = `pagesRange(profileById(doc.print?.profile, customs))[1]`.
4. UI: kit `Popover` + `Button` primitives (`docs/design.md` chip / popover tokens: field hover, popover bg, shadow-md);
   metrics per the roadmap item. `ui-review` before push.

## Touch-set & Test Plan

| Path                               | Why            |
| ---------------------------------- | -------------- |
| `uikit/src/sandbox/store.tsx`      | model          |
| `uikit/src/sandbox/chrome.tsx`     | chip + popover |
| `uikit/scripts/demo-capture.mjs`   | 3 steps        |
| `e2e/kit-filmstrip.spec.ts`        | pins + flow    |
| `docs/roadmap/P5/fill-book-kit.md` | item scope     |

- e2e: 4 empty frames + 12 photos → "4 photos" / "8 photos · 4 spreads" / "20 → 28", Enter, status, disabled
  "Every photo is placed", Ctrl+Z; Esc; Masters; empty gallery; 118-page limit warning; missing note; width 296.
