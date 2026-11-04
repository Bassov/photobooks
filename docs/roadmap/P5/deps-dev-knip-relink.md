# deps-dev-knip-relink

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item deps-dev-knip-relink
Status: done

Lands Dependabot #443 (dev group: `@types/node`, `eslint`, `fake-indexeddb`, `knip` 6.44.1, `oxc-transform-react`, `typescript-eslint`, `wrangler`). knip 6.44.1 tracks `import().then()` member usage, so the lone dynamic `import('./relink')` in `src/editor/projectSession.ts` no longer marks every `src/editor/relink/index.ts` export as used (29 unused exports + 2 unused types).

## Scope

- [x] `package.json` + `pnpm-lock.yaml`: merge the #443 head (0fb7d48) as is; no `pnpm install`.
- [x] `src/editor/relink/index.ts`: keep only the names imported through the barrel (`RelinkHost`, `getProblemRevisionSnapshot`, `missingAssetChecker`, `subscribeRelink`, `exposeRelinkTestApi`); other code imports from the submodules.
- [x] Remove submodule exports that become unused after the trim (none at the time of the change); no `knip.json` ignore entries.
- Off limits: SpreadsPanel / MastersPanel thumbs, LayoutSection / uikit; no other source changes.
- **Done when:** `pnpm knip` exit 0 with knip 6.44.1; `pnpm typecheck` and unit tests of touched files green; PR supersedes #443 and lists each removed export and changed importer.
- **Browser check:** N/A (barrel re-exports and dev dependencies only; no runtime behavior change).
