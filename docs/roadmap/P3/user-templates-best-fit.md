# user-templates-best-fit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item user-templates-best-fit
Status: done

## Scope

- [ ] Best fit for a gap drop also considers the user's saved templates of the target's page count (`pages`), scored the same way as builtins (slot aspect classes on the target trim via `customLayoutRects`); on equal score the earlier candidate wins (builtins first, then save order); a custom winner is applied with `applyCustomLayout`; the saved list is wired from `src/editor/multiDrop.ts` (every `bestTemplateId` caller listed in the PR) (Designer spec `user-templates` UT6)
- **Done when:** `best.ts` unit + PBT (≥1000 runs): a saved template that scores strictly better wins; ties keep the builtin; wrong-shape templates are never chosen; existing multi-drop e2e green unchanged
- **Kit components:** none (core + drop wiring, no UI)
- **Demo:** n/a (no visible UI change)
- **Musts:** see Scope
- **Hard nos:** `uikit/`, `src/editor/LayoutSection.*` (`user-templates-picker`), `libraryDocument` / `savedTemplates` internals (`user-templates-store`)
- **Test:** unit + PBT; `e2e/multi-drop-fill.spec.ts` unchanged and green
- **Browser check:** code review only (no visible UI change)
