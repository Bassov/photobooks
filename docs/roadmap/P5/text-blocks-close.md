# text-blocks-close

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item text-blocks-close
Status: done

## Scope

- [ ] Audit each `text-blocks` (P2) Scope line against main and name its covering test in the PR body: inline editing + built-in styles (title, caption, body); fonts preloaded before first measure; typing re-renders only the edited frame; INP ≤ 100 ms gate for 200 fast characters; caption renders the same in workspace and spread thumbnails.
- [ ] Add the missing tests (docs + tests only, no product code in `src/` or `uikit/`): the overflow measure waits for the book fonts, loaded once; typing in a text frame re-renders no spread and its commit re-renders only the edited spread (`src/editor/TextEditOverlay.render.test.tsx`); the spread thumbnail sets a caption like the workspace at its own scale (`e2e/text-frames.spec.ts`).
- [ ] Close `text-blocks` and this item with `pnpm roadmap done` (item files only; the index is synced by the owner).
- **Done when:** the PR body maps every `text-blocks` Scope line to a covering test (path:line or "added in this PR"); `pnpm roadmap check` green; `pnpm roadmap next` no longer returns `text-blocks`.
- **Browser check:** N/A (tests only); the e2e above walks add caption → edit inline → workspace vs spread thumbnail.
- **Perf:** N/A (no product change); the existing INP gate `e2e/text-frames.spec.ts` "typing 200 characters" stays.
- **Off limits:** `e2e/fixtures/paintProbe.ts`, the e2e-paint-probe specs, `e2e/parent-overrides.spec.ts`, `e2e/parent-spreads.spec.ts`.
