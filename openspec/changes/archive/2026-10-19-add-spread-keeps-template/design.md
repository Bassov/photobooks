# Design

## Context

See proposal.md — Why. `addSpread` always applies `'one-per-page'` (`spreads.ts`). Pasteboard `onAddSpread` dispatches `{ type: 'addSpread' }` with no template. Template bar radiogroup `aria-label` is `"Spread template"`. Owner decision: copy the active spread's template when Add spread is pressed. Callers in `projectSession` / `bookStore` session book stay on the default.

## Goals / Non-Goals

**Goals:**

- Optional `templateId` on `addSpread` / `BookOp` `addSpread`, validated with `isTemplateId`, default `'one-per-page'`.
- Pasteboard passes `getSpreadTemplateId(markedId)` into the op when Add spread is pressed.
- Radiogroup accessible name clarifies per-active-spread scope (e.g. "Template for this spread").
- Unit, property, view, and e2e regression (fails on main: radio snaps to One per page).

**Non-Goals:**

- Changing `projectSession.ts` or `bookStore.ts` session-book callers.
- Schema bump, new subsystem, dependency, or gate edits.
- Changing reveal / camera / page-role reapply logic beyond using the chosen template for the inserted spread.

## Decisions

1. **Copy active template (option a)** — When Add spread runs, the inserted spread gets the marked spread's catalog template. No active / null template → `'one-per-page'`. Alternative rejected: always one-per-page (current bug); prompt for template (out of scope).

2. **Optional `templateId` on the op** — `addSpread(book, { templateId? })` uses `isTemplateId`; invalid/missing → `'one-per-page'`. `applyBookOp` forwards it. Session/import omit it and keep today's default. Alternative: require template always — breaks existing callers.

3. **UI wiring in Pasteboard only** — `onAddSpread` reads `markedId` (already used for the bar), resolves `getSpreadTemplateId(markedId)`, dispatches `{ type: 'addSpread', templateId }`. After add, pin `activeId` to the new spread while its intersection ratio stays > 0 so the template bar shows the copied template (reveal alone can leave an earlier in-port spread as active via `pickActiveSpread` ties). `SpreadTemplateBar` only updates `aria-label`.

4. **Page-role reapply unchanged** — `reapplyChangedPageRoles` still re-applies catalog templates on neighbors whose page count changed; the new spread's frames come from `applyTemplate(..., chosenId)`.

5. **Tests** — Unit: 4-grid copy, invalid id fallback, first/last roles still reapplied. Property: any valid `templateId` keeps invariants. View: Pasteboard add-spread with active non-default template. e2e: 4-grid → Add spread → four placeholders + radio 4-grid; scroll back to spread 1 still 4-grid; keep `assertDocumentFitsViewport`.

## Touch-set

- `src/core/ops/spreads.ts`, `src/core/ops/applyBookOp.ts`, `src/core/ops/ops.test.ts`
- `src/editor/Pasteboard.tsx`, `src/editor/SpreadTemplateBar.tsx`
- `src/editor/Pasteboard.view.test.tsx`, `src/editor/SpreadTemplateBar.test.tsx` (aria-label if asserted)
- `e2e/template-unplace.spec.ts` or `e2e/spread-view.spec.ts` — regression
- `openspec/specs/pasteboard/spec.md` — via archive sync
- `docs/roadmap/M2.2/add-spread-keeps-template.md` — scope/Status ticks only (not UI-kit / Size region)

No quality-gate or package.json edits. Do not edit `projectSession.ts` / `bookStore.ts` session-book callers.

## Risks / Trade-offs

- [Risk] Invalid `templateId` from a buggy caller → Mitigation: `isTemplateId` fallback to `'one-per-page'`; unit locks it.
- [Risk] e2e flake on reveal → Mitigation: reuse existing contain helpers; one green local run; CI burn-in owns flake.
- [Risk] Parallel sessions touch filmstrip / processPhoto → Mitigation: stay in touch-set; never edit those files.

## Migration

None — additive option; default preserves prior call sites. Rollback = revert PR.
