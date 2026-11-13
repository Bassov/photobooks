## Decisions

1. Keep the ≥16-hex rule (photo keys `assets/<sha256>.webp`, existing `viewer/chunk-<hex>.js` case) and add a second rule in `cacheControlOf`: the key has a `viewer/assets/` directory and its last segment is `<name>-<8 of [A-Za-z0-9_-]>.<ext>[.<ext>…]`. This is Vite's default `assets/[name]-[hash].ext` for chunks, entries and emitted assets (vite.config.ts sets no file-name option). A local build emits js / css / svg this way. Hashes contain `-` and `_` (`curl-ysPz2-FY.js`, `normalizeOrientation-1-l9tejE.js`), so the hash class includes them.
2. The 8-char hash must contain an uppercase letter or a digit. `my-settings.js` (8 lowercase letters) then stays `no-cache`. Every hash in the p4 evidence and in a local build passes. A rare lowercase-only hash fails safe (`no-cache`).
3. Only `viewer/assets/` gets the Vite rule. Nothing else in the site tree comes from the bundler (`viewer/fonts/` is `public/`, pages and data are generated), so a dash-named page asset is never pinned.
4. HTML / JSON keep `no-cache` through `fileKind`; the manifest keeps `no-store`.

## Touch-set & Test Plan

| Path                              | Why                             |
| --------------------------------- | ------------------------------- |
| `src/publish/publishSite.ts`      | `cacheControlOf` Vite-hash rule |
| `src/publish/publishSite.test.ts` | new cases + p4 key-list publish |

- Reuse: `fileKind`, `createFakeR2`, the existing `cacheControlOf` `it.each` table (new rows appended, old rows unchanged).
- Tests: unit table rows from Done when. Plus one fake-bucket publish of the p4 `viewer/` key list: every `viewer/assets/` object is stored `immutable`, every `viewer/fonts/` object `no-cache`. No e2e (worker headers, no UI).
