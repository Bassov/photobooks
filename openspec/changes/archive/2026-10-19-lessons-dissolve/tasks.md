# Tasks

## 1. Mandates and journal removal

- [x] 1.1 Update `openspec/config.yaml`: drop lessons read/append; add repeat→check; doc budget; gate-owner pointers for #76/#82 lines — verify `rg lessons openspec/config.yaml` is empty
- [x] 1.2 Delete `docs/lessons.md` and `docs/lessons/**`; update `AGENTS.md`, `docs/future-architecture.md`, implementation reviewer (`[lesson]`→`[repeat]` naming check), `scripts/agent.mjs` + test fixture path — verify journal paths gone

## 2. Spec sync and gotcha homes

- [x] 2.1 Apply delta specs into main `openspec/specs/{agent-context,preview-hosting,editor-shell,derived-cache,asset-source,spread-view,frame-budget}/spec.md` — verify each ADDED/MODIFIED/REMOVED requirement is present or removed as specified
- [x] 2.2 Retarget live roadmap mentions (`agent-rules`, INTRO, dissolve item ticks, narrative in `docs/roadmap.md` via allowed wording / `roadmap` tools only for new items) so process text does not point at the journal

## 3. Named checks for gaps

- [x] 3.1 Add or confirm unit coverage for FileList copy-before-clear (EditorShell public path) and referential stability of a public `getSnapshot` used with `useSyncExternalStore` — verify tests fail if copy/`Object.is` regresses
- [x] 3.2 Build the PR disposition table for all 24 lines (01–24) plus note extras 25–29 + dated; prove `rg -i lessons` clean outside archives and allowlist (change dir until archive; dissolve item file; docs/roadmap.md index/goal slug lines; INTRO Phase-3 slug list)

## 4. Follow-up roadmap item

- [x] 4.1 `pnpm roadmap add rules-dedup --after lessons-dissolve` with owner Scope/Done-when (do not implement) — verify item file exists and `roadmap check` warns/passes as expected

## Verification

- [x] pnpm check (only OK lines; evidence `/tmp/lessons-dissolve-check2.log`)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (docs/process; no UI)
- [x] pnpm stryker:diff — OK stryker-diff (247.5s), evidence `/tmp/lessons-dissolve-stryker.log`
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI/bundle)
- [x] UI in scope: browser smoke evidenced — N/A (no UI)
- [x] Docs/rules sync: AGENTS.md, future-architecture, config, reviewer, roadmap item ticks / narrative reword; no new alwaysApply rules
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep/security surface)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced: Verdict pass, agent e1256154-54fe-4731-896b-172485ad0812, delta re-review)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass after delta; agent c32e09b1-ae04-458d-a09a-9dd46892b546)
- [x] Manual check — N/A (prep; no Browser check on the item); see Manual test scenarios
- [x] Security Review — N/A (not security-tagged; no security surface)

## Disposition of the 24 journal lines (01–24)

| #   | Short                                      | Disposition                                                                                                                   |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 01  | No File/Blob in domain                     | deleted duplicate — `openspec/specs/book-core/` (Assets by id only)                                                           |
| 02  | Heavy work in Web Workers                  | deleted duplicate — `openspec/config.yaml` quality bar                                                                        |
| 03  | 60 fps / no 200 ms LoAF                    | deleted duplicate + named spec — quality bar; `frame-budget` Shared performance budgets (zero LoAF, no 200 ms)                |
| 04  | Do not weaken gates (#76)                  | quality bar + named owners `gate-ratchet`, `gate-weakening-guard`, `stryker-disable-budget` (pointers only)                   |
| 05  | Exploratory → Playwright                   | deleted duplicate — quality bar + apply guidance                                                                              |
| 06  | Copy input.files before clear              | named check — `EditorShell.test.tsx` “copies photo input FileList…”; comment at call site; `editor-shell` Copy FileList SHALL |
| 07  | useSyncExternalStore snapshot stability    | named check — `projectSession.test.ts` getProjectSessionSnapshot Object.is; `thumbCache.test.ts` getThumbUrl Object.is        |
| 08  | New src/ files in mutation scope           | named check — `scripts/check-mutation-scope.mjs` / `pnpm check` mutation-scope; `ci-gates` mutate-scope requirements          |
| 09  | No Stryker exclude for modified file (#82) | quality-bar pointer → `stryker-diff-gate` / `exclusions-registry` (not implemented here)                                      |
| 10  | Do not unmount drag source                 | named spec + comment — `spread-view` Drag source stays mounted; `SpreadView.tsx` comment                                      |
| 11  | Grid min-width / shell viewport            | named check — e2e `assertDocumentFitsViewport`; EditorShell CSS containment tests                                             |
| 12  | scrollLeft ≠ page containment              | deleted duplicate — quality bar + `assertDocumentFitsViewport`                                                                |
| 13  | Progressive mid-import rAF pacing          | named spec — `editor-shell` Progressive import pacing                                                                         |
| 14  | Visibility must not abort import           | named spec — `asset-source` Visibility must not abort off-screen import jobs                                                  |
| 15  | setThumbUrl puts via trackHashJob          | named check + spec — `pendingHashes.test.ts`; `derived-cache` Encode-after-hash; `thumbCache.ts` comment                      |
| 16  | Open existing library loads book           | named spec + e2e — `editor-shell` Open existing library; `e2e/open-save.spec.ts` adopt                                        |
| 17  | Variable-width absolute offsets            | named spec — `editor-shell` Variable-width filmstrip packing                                                                  |
| 18  | Sliding window covers scrollport           | deleted duplicate / apply guidance + named spec — `editor-shell` Sliding filmstrip window                                     |
| 19  | Empty gallery full width                   | named check + spec — `Filmstrip.test.tsx` empty-state; `editor-shell` Empty gallery UI                                        |
| 20  | Progressive reveal vs scrollLeft           | named spec — `editor-shell` Progressive reveal keeps up                                                                       |
| 21  | UI apply not green-verify alone            | deleted duplicate — quality bar + apply guidance                                                                              |
| 22  | Cloudflare pin Node via .nvmrc             | named spec — `preview-hosting` Workers Builds pin Node via nvmrc                                                              |
| 23  | Changed scrollports assertNamedScrollport  | deleted duplicate — apply guidance                                                                                            |
| 24  | UI verification needs ui-review            | deleted duplicate — quality bar + apply guidance                                                                              |

### Extras dissolved with the journal (post-#78)

| #     | Short                                    | Disposition                                                                             |
| ----- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| 25    | Do not pace thumb publish on rAF alone   | enforced in code/comments — `thumbCache.ts` publish-on-decode; e2e-local-flakes lineage |
| 26    | Ctrl/meta wheel zoom coalesce            | stated in spread-view / frame-budget work; e2e-frame-budget-flakes lineage              |
| 27    | Local Playwright flake proof ≤3          | stated in `.cursor/rules/testing.mdc` / agent test-run budget                           |
| 28    | Hash jobs before gallery flush           | named check — `pendingHashes` + projectSession/open-save lineage                        |
| 29    | React Compiler must observe store values | code/comments in FilmstripItem / ConnectedSpreadView lineage                            |
| dated | Necessary-minimum reviewer parity        | already in quality bar + necessary-minimum-rules archive                                |

## Manual test scenarios

N/A — docs/process prep; no UI Browser check on the item.
