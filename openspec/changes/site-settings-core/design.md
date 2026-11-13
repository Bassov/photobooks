## Decisions

1. One `parseSiteSettings(input: unknown)` in `libraryDocument.ts`, used by the reader, the memory adapter, `serializeLibrary` and the store; clipping counts code points; no field left → `undefined`, so the `site` key is omitted. No schema bump.
2. `siteMetaOf(meta, url?)` in `siteModel.ts` (type-only `LibraryMeta` import); the lead fallback stays in `homeLead`. Export sends `siteMetaOf(frozen.meta)`, Publish `siteMetaOf(frozen.meta, hosting.publicBaseUrl)`.
3. `siteSettingsStore.ts` copies `printProfilesStore.ts` (queue, read-modify-write, session-only after a failed write + S2 status). `setSiteSettings(patch)` normalises `{ ...state, ...patch }` (`''` clears) and does nothing when equal. Bound in `projectSession.ts`.
4. `?siteSettings=<JSON>` seed through `parseSiteSettings`, DEV / `VITE_TEST_FIXTURES=1` only; bad JSON ignored.

## Touch-set & Test Plan

| File                                 | Why                                    |
| ------------------------------------ | -------------------------------------- |
| `src/project/types.ts`               | `SiteSettings`, `LibraryMeta.site`     |
| `src/project/libraryDocument.ts`     | `parseSiteSettings`, parse / serialize |
| `src/project/memory.ts`              | memory adapter keeps `site`            |
| `src/site/siteInput.ts`              | `SiteMeta.theme`                       |
| `src/site/siteModel.ts`              | `siteMetaOf`                           |
| `src/editor/siteSettingsStore.ts`    | new store                              |
| `src/editor/projectSession.ts`       | bind the store                         |
| `src/editor/export/exportSiteRun.ts` | `input.site`                           |
| `src/editor/publish/startPublish.ts` | `input.site` with url                  |

- Reuse: `printProfilesStore.ts` shape, `siteTitle`, `homeLead`, `buildSiteTree` default renderer.
- Tests: the roadmap C1–C3 lock-ins (unit + PBT, `siteSettingsStore.test.ts`, `buildSiteTree.test.ts`); no e2e (no UI).
