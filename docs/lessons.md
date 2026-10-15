# Lessons

Living journal of repeated review findings. Read before OpenSpec apply. Append one durable rule when a finding repeats; do not turn this into a checklist duplicate of `openspec/config.yaml`.

- Do not store `File` / `Blob` in persisted book or photo domain models — use ids; binary data stays in platform/store layers.
- Heavy image decode, render, and encode MUST run in Web Workers — never block the main thread.
- 60 fps is a product requirement: gate interactions on zero LoAF / handler p95 / INP (`src/perf/budgets.ts`); do not reintroduce a 200 ms LoAF allowance.
- Do not weaken `tsconfig` / ESLint, add blanket `eslint-disable` / `@ts-ignore` / `as any`, or skip tests to make checks green.
- Bugs found via exploratory browser or MCP sessions MUST be locked in with a Playwright test under `e2e/` that would have failed before the fix.
- Copy `input.files` into an array before setting `input.value = ''` — `FileList` is live and empties on clear.
- `useSyncExternalStore` getSnapshot return values must be referentially stable when data is unchanged (do not allocate a new object/array each call).
- When adding a new `src/<capability>/` domain module or an editor module that holds drop, selection, or dispatch logic, extend both `scripts/stryker-diff.mjs` and `stryker.config.json` `mutate`, or `stryker:diff` will skip it and the PR will have no mutation comment.
- Do not unmount a drag source during drop. `dragend` on a detached node never reaches `document`, so a click-suppress flag armed at `dragstart` stays stuck.
- CSS Grid children default to `min-width: auto`; a wide virtualized spacer will stretch the page unless the shell locks to the viewport (`overflow: hidden`, `max-width: 100%`) and grid/filmstrip children set `min-width: 0`.
- Asserting `scrollLeft` on an overflow element does not prove page containment — assert `documentElement` scroll size ≤ client size (shared e2e `assertDocumentFitsViewport`).
- Progressive mid-import filmstrip mounts need tighter rAF pacing (gallery flush / reveal / thumb flush) — do not re-freeze the gallery id list to pass LoAF.
- Filmstrip visibility may boost decode priority but must not abort off-screen import jobs — aborted assets never retry and leave permanent gray placeholders.
- Variable-width filmstrip packing uses absolute offsets from each card’s end + gap — never a fixed max-width stride (`estimatedRowSize` / uniform slot).
- Sliding virtual windows MUST cover scrollport width (+ overscan) from aspect strides — a fixed item count leaves mid-scroll holes for narrow (portrait) cards.
- Empty gallery UI must not render inside a 1px / min-width virtualizer window — empty copy lives at full scrollport width with its own e2e geometry assertion.
- Progressive reveal must not lag behind scrollLeft while the spacer is full gallery width (windowing already limits DOM); otherwise mid-scroll shows a dead zone.
- UI-scoped apply is not complete on green verify alone — empty + happy + scroll/interact browser smoke (and `ui-review` layout smoke) before push.
- Cloudflare Workers Builds runs asdf and only the image's preinstalled Node patches. `.tool-versions` must name that exact `nodejs` version, or `pnpm` fails before install.
