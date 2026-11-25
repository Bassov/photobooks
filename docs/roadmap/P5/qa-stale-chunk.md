# qa-stale-chunk

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item qa-stale-chunk

QA-1 (major) from the prod QA report of 2026-11-25 (PR #725): after a redeploy an open tab that presses Preview loads a missing lazy chunk; prod answers `/assets/SitePreview-<old>.js` with 200 `text/html` (the SPA index.html), the dynamic import throws and the app goes blank.

## Scope

- [ ] Chunk-load failure never blanks the app: an error boundary around the lazy Site preview keeps the editor; on a chunk-load error (incl. `vite:preloadError`) the app saves pending edits, then reloads once (sessionStorage guard against a loop), or shows an error with "Reload" when it cannot or already did.
- [ ] Missing hashed `/assets/*` return 404, not index.html (site Worker), while SPA routes still fall back to index.html.
- [ ] Every dynamic `import(` and worker URL caller is listed in the PR body as fixed or left out with a reason.
- **Browser check:** `e2e/stale-chunk.spec.ts` — stale `SitePreview-*.js` served as text/html: Preview keeps the editor, one reload or a "Reload" error, no loop.

## Done when

- New e2e `e2e/stale-chunk.spec.ts`: route `/assets/SitePreview-*.js` to index.html as text/html, press Preview → editor stays rendered (no empty `#root`), and either one reload happens or a "Reload" error is shown; no infinite reload.
- Unit test for the reload-once guard. Existing Preview e2e specs pass unchanged.
- Worker handler unit test: `/assets/missing-abc.js` → 404, `/books/x` → index.html.
