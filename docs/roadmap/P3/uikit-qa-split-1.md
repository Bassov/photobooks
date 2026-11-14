# uikit-qa-split-1

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item uikit-qa-split-1
Status: done

## Scope

Owner 2026-11-14: freeze and split `uikit/scripts/qa.mjs` (2807 lines, 349 `ok()` call sites + 48 `smoke()` / `smokeS()` calls appended per kit version; a conflict hot file). qa.mjs keeps sections 0–3 (token lint, manifest / registry, per-page render, navigation / search / restore, lines 1–293) and the `smoke` / `smokeS` / `D` / `txt` helpers until the last smoke call moves; every block from section 4 on moves to `e2e/kit-<feature>.spec.ts` grouped by feature, same selectors, values and setup, no weakening. Item 1 of a chain (lane uikit-qa). Lane: `uikit/scripts/qa.mjs`, ≤ 5 `e2e/kit-*.spec.ts` per item, this file. No `uikit/src/**`, `src/**`, other e2e specs or playwright config.

- [x] Inventory: the split map below (feature → qa.mjs line ranges → target spec → `ok()` / smoke count → item)
- [x] Batch 1 (§4, v4.x, v5, v0.6.0, v0.6.1 = qa.mjs 314–479, 481–648): 27 `ok()` + 18 smoke → `kit-library` (0 + 10), `kit-editor-canvas` (1 + 6), `kit-tokens` (21 + 0), `kit-credits` (5 + 0), `kit-personal-site` (0 + 2); qa.mjs 349 → 322 `ok()`, 48 → 30 smoke
- **Done when:** PR body counts sum back to 349; `pnpm uikit:qa:quick` green; the 5 touched kit specs green; sections 0–3 untouched.
- **Browser check:** N/A (test move; the moved checks run headless in Playwright).
- **Hard nos:** no kit or product change; no backward compat (Owner 2026-11-02).

## Split map

Line numbers are qa.mjs at `e90d45da` (before batch 1). Count = `ok()` call sites + smoke calls (a smoke call emits one `ok` through the helper; the 2 helper `ok()` sites stay until the last smoke call moves, then go with it). Stateful walks: kit10 (1904–2132), W4 (2133–2177) and W3 (2178–2313) are one scenario each; every item that takes a sub-range replays the walk's setup in its spec.

| Feature                | qa.mjs ranges                                                                                                                                          | Target spec                        | ok + smoke | Item      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ---------- | --------- |
| library                | 314–479 / 481–648 (smokes)                                                                                                                             | `e2e/kit-library.spec.ts`          | 0 + 10     | split-1 ✓ |
| editor canvas          | 314–479 (tooltips, smokes)                                                                                                                             | `e2e/kit-editor-canvas.spec.ts`    | 1 + 6      | split-1 ✓ |
| tokens / surfaces      | 314–479 / 481–648                                                                                                                                      | `e2e/kit-tokens.spec.ts`           | 21 + 0     | split-1 ✓ |
| credits                | 538–569                                                                                                                                                | `e2e/kit-credits.spec.ts`          | 5 + 0      | split-1 ✓ |
| personal site          | 377–420 (smokes)                                                                                                                                       | `e2e/kit-personal-site.spec.ts`    | 0 + 2      | split-1 ✓ |
| spread list            | 650–661, 678–684, 823–826, 2024–2031                                                                                                                   | `e2e/kit-spread-list.spec.ts`      | 2 + 3      | split-2 ✓ |
| book settings          | 662–668, 1714–1718, 2196–2199                                                                                                                          | `e2e/kit-book-settings.spec.ts`    | 2 + 1      | split-2 ✓ |
| sliders                | 701–716, 1198–1208, 1423–1440                                                                                                                          | `e2e/kit-sliders.spec.ts`          | 1 + 4      | split-2 ✓ |
| toggles / swatches     | 717–738                                                                                                                                                | `e2e/kit-toggle-size.spec.ts`      | 0 + 2      | split-2 ✓ |
| tokens / surfaces      | 685–700, 739–750, 783–790, 864–881, 950–1000, 1029–1039, 1053–1058, 1107–1120, 1133–1137, 1157–1159, 1570–1576, 1763–1766, 1791–1794, 1882–1889        | `e2e/kit-tokens.spec.ts`           | 18 + 4     | split-2 ✓ |
| editor chrome          | 751–777, 791–822, 882–905, 934–949, 1040–1052, 1081–1102, 1562–1569, 1723–1732, 1825–1859, 1978–2007                                                   | `e2e/kit-editor-chrome.spec.ts`    | 24 + 2     | split-3   |
| credits                | 778–782, 1160–1182                                                                                                                                     | `e2e/kit-credits.spec.ts`          | 2 + 0      | split-3   |
| library                | 853–863, 1183–1192, 1487–1493, 1577–1592, 1711–1713, 1741–1749, 1757–1760, 2172–2177                                                                   | `e2e/kit-library.spec.ts`          | 10 + 1     | split-3   |
| settings               | 1733–1740                                                                                                                                              | `e2e/kit-settings.spec.ts`         | 1 + 0      | split-3   |
| masters / page numbers | 669–677, 1059–1076, 1121–1132, 1521–1526, 2032–2094                                                                                                    | `e2e/kit-masters.spec.ts`          | 10 + 2     | split-3   |
| editor canvas          | 827–839, 1016–1028, 1077–1080, 1209–1216, 1441–1456, 1527–1561, 1719–1722, 1750–1756, 1761–1762, 1767–1790, 1904–1977, 2008–2023, 2162–2171, 2408–2461 | `e2e/kit-editor-canvas.spec.ts`    | 31 + 3     | split-4   |
| parent overrides       | 1217–1238, 2095–2119                                                                                                                                   | `e2e/kit-parent-overrides.spec.ts` | 4 + 2      | split-4   |
| `#/demo` sandbox       | 1263–1422, 1890–1903                                                                                                                                   | `e2e/kit-demo-sandbox.spec.ts`     | 15 + 0     | split-4   |
| site preview mode      | 1593–1682                                                                                                                                              | `e2e/kit-site-preview.spec.ts`     | 9 + 0      | split-4   |
| personal site          | 1103–1106, 1239–1262, 1683–1710, 1795–1824                                                                                                             | `e2e/kit-personal-site.spec.ts`    | 11 + 0     | split-4   |
| filmstrip              | 906–933, 1138–1156, 1193–1197, 1494–1520, 1860–1881, 2120–2132, 2314–2407                                                                              | `e2e/kit-filmstrip.spec.ts`        | 33 + 4     | split-5   |
| layout picker          | 840–852, 2200–2313                                                                                                                                     | `e2e/kit-layout-picker.spec.ts`    | 22 + 1     | split-5   |
| frame style            | 1001–1015, 1457–1486, 2178–2195                                                                                                                        | `e2e/kit-frame-style.spec.ts`      | 3 + 1      | split-5   |
| cover                  | 2133–2161, 2610–2652                                                                                                                                   | `e2e/kit-cover.spec.ts`            | 13 + 0     | split-5   |
| static export          | 2587–2609                                                                                                                                              | `e2e/kit-in-app-publish.spec.ts`   | 3 + 0      | split-5   |
| text frames            | 2462–2549                                                                                                                                              | `e2e/kit-text-frames.spec.ts`      | 15 + 0     | split-6   |
| default master         | 2550–2586                                                                                                                                              | `e2e/kit-default-master.spec.ts`   | 8 + 0      | split-6   |
| printer presets        | 2653–2800                                                                                                                                              | `e2e/kit-print-presets.spec.ts`    | 27 + 0     | split-6   |

Per item (`ok()` + smoke): split-1 27 + 18 · split-2 23 + 14 · split-3 47 + 5 · split-4 70 + 5 · split-5 74 + 6 (moves the last smoke calls → also drops `smoke` / `smokeS` and their 2 `ok()` sites) · split-6 50 + 0. Sum: 29 (§4 incl. the 2 helper sites) + 264 = 293 moved, 56 left in sections 0–3.

Port notes for later items: 1040–1052 starts its own `node:http` server on `dist/` (use the Playwright webServer at `/uikit/`); 882–905, 1081–1102 and 1825–1859 rely on the global panel-visibility store left by earlier checks (set it explicitly); 1601 `prevOpen` / `stage` feed the `ok` at 1670; 950–1000 fills hue / contrast arrays that are never asserted (only the DPI-badge `ok` counts, like the credits `bad` list in batch 1).
