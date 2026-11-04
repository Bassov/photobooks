## Decisions

1. `library.json` v3 (`migrateV2ToV3` adds `templates: []`). `books` stays strict; `templates` is lenient: each entry is zod-parsed alone (untrusted input) and invalid ones are dropped.
2. Store: `bindSavedTemplatesLibrary(storage | null)` is called from one `setLibraryStorage` in `projectSession.ts`. That covers every `storage =`, including restore and re-grant, which bypass `libraryActivation.ts`. Loads and writes share one chain with a generation guard. Each write is `getLibrary` → `updateLibrary({ ...meta, templates })`, which keeps `books`.
3. Legacy key: imported once with `pages: 2` when the library lists none, and removed only after the write succeeds. The kit seed runs after every load.
4. Guard: `applyCustomLayout(…, pages)` returns `book` on a shape mismatch. In `layoutCatalog`, `layoutRects` returns null and `applyLayout` passes the template's `pages`.

## Touch-set & Test Plan

| File                                                  | Why                          |
| ----------------------------------------------------- | ---------------------------- |
| `src/core/templates/custom.ts`                        | `SavedTemplate` type         |
| `src/core/templates/apply.ts`                         | guard                        |
| `src/core/ops/applyBookOp.ts`                         | op `pages`                   |
| `src/core/index.ts`                                   | add-only export              |
| `src/project/libraryDocument.ts`                      | v3                           |
| `src/project/types.ts`                                | `templates`                  |
| `src/project/memory.ts`                               | parsed shape                 |
| `src/editor/savedTemplates.ts`                        | store                        |
| `src/editor/layoutCatalog.ts`                         | shape-aware                  |
| `src/editor/projectSession.ts`                        | bind                         |
| `src/editor/session/libraryActivation.ts`             | comment: keeps templates     |
| `docs/roadmap/P3/user-templates-store.md`             | stub item filled             |
| `src/project/libraryStorage.contract.test-helpers.ts` | expectations                 |
| `src/editor/LayoutSection.saved.test.tsx`             | `pages: 1` (test only)       |
| `e2e/design-r2-layout-picker.spec.ts`                 | persist via `?testLibrary=1` |

Tests (v3 expectations or new cases) in `libraryDocument`, `savedTemplates`, `custom` + `custom.pbt` (≥1000 runs), `layoutCatalog`, `projectSession`, `libraryActivation`, `fsa/layout`, `fsaLibraryStorage` and `publish.pbt`. The PR body lists every caller of save / apply / load.
