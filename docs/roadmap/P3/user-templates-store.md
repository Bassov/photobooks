# user-templates-store

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item user-templates-store

## Scope

- [ ] Own templates move into `library.json` (`templates` list, invalid entries dropped one by one, every change through `updateLibrary`, switching library reloads the list, one-time import of `localStorage['photobooks.templates.v1']` as `pages: 2` then the key is removed, `?templates=kit` seed kept); a template is `{id, name, pages: 1 | 2, slots}` and `applyCustomLayout` is a no-op when `pages` differs from the target spread's page count (Designer spec `user-templates` UT1 core guard + UT5)
- **Done when:** `libraryDocument` tests (round-trip, drop-invalid one by one, older → current migration, localStorage import once); unit / PBT (≥1000 runs): after apply, slot aspects match the source on a spread and on page 1 / last page (trim-normalized); apply with mismatched `pages` changes nothing; `savedTemplates` / `layoutCatalog` / `custom` tests updated and green
- **Kit components:** none (store + core, no picker UI)
- **Demo:** n/a (no visible UI change)
- **Musts:** see Scope
- **Hard nos:** no picker UI (`src/editor/LayoutSection.*` is `user-templates-picker`); no best-fit change (`best.ts`, `multiDrop.ts`, `galleryDrop.ts` are `user-templates-best-fit`); `src/core/index.ts` exports add-only
- **Test:** unit + PBT; the existing "saved template persists" e2e keeps passing through `library.json`
- **Browser check:** code review only (no visible UI change)
