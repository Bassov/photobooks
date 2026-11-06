# design-r20-kit-mod-arrows

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r20-kit-mod-arrows
Status: done

## Scope

- [x] Kit site-viewer book-page keydown (`uikit/src/features/site-viewer.tsx`) ignores Alt / Ctrl / Meta + Arrow / Home / End (Designer site-preview-mode §4, M96); prod already does. Kit only, no `src/` edits.
- **Browser check:** kit `#/demo` Preview on Pages 2–3: Alt / Ctrl / Meta + ← → Home End keep the page label; plain → steps to Pages 4–5.

## Done when

- Kit e2e: in the kit editor preview on Pages 2–3, Alt+→, Ctrl+→, Meta+→ (and the ← / Home / End counterparts) leave the page label unchanged; plain → still steps to Pages 4–5.
- Prod untouched.
