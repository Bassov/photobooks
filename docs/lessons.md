# Lessons

Living journal of repeated review findings. Read before OpenSpec apply. Append one durable rule when a finding repeats; do not turn this into a checklist duplicate of `openspec/config.yaml`.

- Do not store `File` / `Blob` in persisted book or photo domain models — use ids; binary data stays in platform/store layers.
- Heavy image decode, render, and encode MUST run in Web Workers — never block the main thread.
- 60 fps is a product requirement: gate interactions on zero LoAF / handler p95 / INP (`src/perf/budgets.ts`); do not reintroduce a 200 ms LoAF allowance.
- Do not weaken `tsconfig` / ESLint, add blanket `eslint-disable` / `@ts-ignore` / `as any`, skip/`fixme`/`test.fail`/retries, loosen assertions or tolerances, delete tests or helpers, add or widen coverage or mutation exclusions, lower thresholds, or remove checks for any reason — fix with code, tests, or a test seam. No `Stryker disable` until `stryker-diff-gate` defines a budget.
- Bugs found via exploratory browser or MCP sessions MUST be locked in with a Playwright test under `e2e/` that would have failed before the fix.
- Copy `input.files` into an array before setting `input.value = ''` — `FileList` is live and empties on clear.
- `useSyncExternalStore` getSnapshot return values must be referentially stable when data is unchanged (do not allocate a new object/array each call).
- New production files under `src/` are in mutation scope via the `stryker.config.json` globs. Exclude a file only when mutating it is pointless, with a one-line reason in `stryker.mutate.md`. `pnpm verify:fast` fails when a production file is neither covered nor excluded.
- Do not add or widen a Stryker exclude for a file this same change modifies with new product logic — extract pure helpers (or the new hook module) into mutate scope and cover them; thin chrome excludes must not hide settle/fit/reveal behavior introduced in the PR.
- Do not unmount a drag source during drop. `dragend` on a detached node never reaches `document`, so a click-suppress flag armed at `dragstart` stays stuck.
- CSS Grid children default to `min-width: auto`; a wide virtualized spacer will stretch the page unless the shell locks to the viewport (`overflow: hidden`, `max-width: 100%`) and grid/filmstrip children set `min-width: 0`.
- Asserting `scrollLeft` on an overflow element does not prove page containment — assert `documentElement` scroll size ≤ client size (shared e2e `assertDocumentFitsViewport`).
- Progressive mid-import filmstrip mounts need tighter rAF pacing (gallery flush / reveal / thumb flush) — do not re-freeze the gallery id list to pass LoAF.
- Filmstrip visibility may boost decode priority but must not abort off-screen import jobs — aborted assets never retry and leave permanent gray placeholders.
- DerivedCache puts from `setThumbUrl` (encode-after-hash) must go through `trackHashJob` so Save/`awaitPendingHashes` cannot finish before OPFS writes — otherwise reload leaves gray filmstrip holes, worst at the gallery tail.
- Open of an existing library must load a stored book into an empty editor (prefer contentful books). Never treat “same id as `session-book` already exists” as a no-op adopt — that leaves the empty in-memory placeholder on screen while disk has the real document.
- Variable-width filmstrip packing uses absolute offsets from each card’s end + gap — never a fixed max-width stride (`estimatedRowSize` / uniform slot).
- Sliding virtual windows MUST cover scrollport width (+ overscan) from aspect strides — a fixed item count leaves mid-scroll holes for narrow (portrait) cards.
- Empty gallery UI must not render inside a 1px / min-width virtualizer window — empty copy lives at full scrollport width with its own e2e geometry assertion.
- Progressive reveal must not lag behind scrollLeft while the spacer is full gallery width (windowing already limits DOM); otherwise mid-scroll shows a dead zone.
- UI-scoped apply is not complete on green verify alone — empty + happy + scroll/interact browser smoke (and `ui-review` layout smoke) before push.
- Cloudflare Workers Builds: do not pin Node via `.tool-versions` / asdf. The image rotates which exact patches are preinstalled (logs show “Detected nodejs@24.x” for the image default — that is not our pin). Official overrides are `.nvmrc` / `.node-version` / `NODE_VERSION` (major `22` is enough). asdf + an exact missing patch fails before `pnpm install`. Separate flake: `wrangler preview` can 504 — retry, not an app bug.
- New or changed in-app scrollports need Playwright `assertNamedScrollport` (overflow interact), not only empty/happy document-fit.
- UI-scoped Verification must record an evidenced `ui-review` pass (layout smoke included) before implementation review / archive — chat claims alone are not enough.
- Do not pace thumb URL publish or bookStore gallery/meta flush on `requestAnimationFrame` alone — background tabs under parallel Playwright freeze rAF and leave permanent placeholders / stale aspect. Publish thumbs when decode completes; dual-schedule gallery flush with rAF plus a short `setTimeout` watchdog (~32ms) so hidden tabs still flush without collapsing visible-tab LoAF pacing. Spread preview may fall back to the filmstrip thumb (with per-asset `subscribeThumb`, not a global publish generation) until the covering tier is ready. Tier display subscriptions must use a per-spread snapshot key — a global `version`/`urls` object re-renders every mounted spread on each swap and flakes continuous-zoom LoAF under CPU throttle.
- Ctrl/meta wheel zoom must coalesce deltas to one apply per animation frame — a same-task burst of `wheel` events (trackpad or Playwright `dispatchCtrlWheel`) otherwise packs many `zoomAtPoint` calls into one LoAF.
- Local Playwright flake proof: at most `--repeat-each=3` when a specific fix needs a check; CI burn-in is the authoritative repeat evidence (do not burn 20× locally).
- Content-hash jobs can finish before the gallery flush inserts the asset — `patchAssetRecord` must merge into pending records / early patches, and `getAssetContentHash` must read those pending values. Otherwise Save persists assets without `contentHash`, Open/`ensureThumb` never hits DerivedCache, and filmstrip thumbs stay gray forever (fresh-session Open flake).
- React Compiler (`vite` `react({ compiler: true })`) can strip `useSyncExternalStore` / state whose value is only `void`’d or used in a dead ternary — the subscribed value must flow into the returned UI (e.g. fallback expression), or late `setThumbUrl` will not re-render spread frames.
