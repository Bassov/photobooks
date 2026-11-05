## Decisions

1. New zod-free `catalog.ts`: `printShopProfiles()` (`PrintProfile & {source, checked}`, A→Z, empty) and `builtInPrintProfiles()` = Generic + shops; it replaces `printProfile.ts` `builtInProfiles()`.
2. D6: `resolvePrintProfile(ref, customs = [])` = built-in → custom → `ref.snapshot`, then overrides; `bookPrintProfile(book, customs)` falls back to Generic and feeds DPI, validation, cover geometry and `setPageCount`. Unknown id → `unknown-profile` plus the Generic checks.
3. `printIssues(book, customs)` adds below-min / above-max page issues; strings, summary, hint and `editableProfileIssues` live in zod-free `print/profileText.ts`.
4. D5 + D4: `pageCountRange(profile)` (20 to whole even steps ≤ min(120, max)) and `clampPageCount(n, range)`; op `setPrintProfile {id, customs?}` in `ops/bookSettings.ts` (unknown id → same book; custom → snapshot).
5. Book schema stays 11 (`snapshot` optional). `library.json` v4 (v3→v4 upgrade in `libraryDocument.ts`) adds `printProfiles` and `defaultPrintProfileId`; `createBookInLibrary` applies `setPrintProfile` with them.

## Touch-set & Test Plan

| File                              |
| --------------------------------- |
| `src/core/print/catalog.ts`       |
| `src/core/print/profileText.ts`   |
| `src/core/print/profileSchema.ts` |
| `src/core/print/coverGeometry.ts` |
| `src/core/printProfile.ts`        |
| `src/core/schema.ts`              |
| `src/core/pages.ts`               |
| `src/core/ops/bookSettings.ts`    |
| `src/core/ops/applyBookOp.ts`     |
| `src/core/ops/spreads.ts`         |
| `src/core/index.ts`               |
| `src/project/libraryDocument.ts`  |
| `src/project/types.ts`            |
| `src/project/memory.ts`           |
| `src/editor/projectSession.ts`    |

- Reuse: `parseEach`, `pagesOf`, the profile schema.
- Tests: unit for catalog, resolution, issues / text, op, library v4 + contract, new-book default; PBT for page-count range and resolution / pick. No e2e (no UI).
