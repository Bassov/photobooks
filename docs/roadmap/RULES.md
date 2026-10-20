# Roadmap process

The plan is the index `docs/roadmap.md` plus one file per item under `docs/roadmap/`. Together they are the single source of truth for what gets built and in which order; issues, proposals and review notes are inputs until they land there. Agents read and change them only through the CLI (`pnpm roadmap`, `scripts/roadmap.mjs`; agent usage: skill `roadmap`). `pnpm roadmap check` validates the layout and runs inside `pnpm test`.

## Layout

- `docs/roadmap.md`: header, `## Order`, one block per active milestone (`## <ID> — <title>`, goal / review-cut lines, one line per item), `## Deferred (not scheduled)` and `## Archive`. One line per item: `- [ ] [tag] [slug](roadmap/<M>/<slug>.md) — title`. Index order is priority.
- `docs/roadmap/<M>/<slug>.md`: the item: slug heading, Tag, Milestone, Title, then its scope (nested checkboxes, **Done when:**, **Perf:**, **Browser check:**, **UI ref:** lines). `INTRO.md` holds longer milestone notes.
- `docs/roadmap/archive/<M>/`: a finished milestone (`README.md` with its block, plus its item files). `docs/roadmap/DEFERRED.md`: ideas that are not scheduled.

## Items

- Each item is **one OpenSpec change = one agent iteration = one PR**; the slug is the change name. Its nested checkboxes are the scope of that change and are ticked in the item file during apply. Do not pull scope from later items.
- Tags:
  - **[prep]**: groundwork with no new user-facing UI (pure modules, adapters, workers), verified by tests. Its **Done when:** line is the success criteria.
  - **[feature]**: a visible change on the Cloudflare preview URL. The **Browser check:** line describes what to verify.
  - **[contingency]**: a fallback for a gate owned by a named item, done only if that gate fails. When the gate-owning change is archived with the gate green, close it in the same PR as not needed: `pnpm roadmap done <slug> --note "not needed (gate passed in \`<name>\`)"`.
- **(Security Review: …)** after the title: the change needs a Security Review before archive.
- **60 fps is part of done.** Every `[feature]` ships a perf scenario for the interaction it adds (gates in `docs/future-architecture.md`, "Performance model"); a regression blocks the PR. **Perf:** lines name the techniques the change must use. The Browser check includes watching the interaction for stutter (DevTools Performance panel, frame rendering stats). For features with an in-app scrollport, it also verifies no page-level H/V scroll; the named region is the scrollport (Playwright: `assertDocumentFitsViewport`).
- **One visual language.** From M2.5 on, UI work uses the tokens and primitives in `docs/design.md` (`src/ui/`); a change that needs a new token, primitive or state adds it to the design reference and the `?specimen` page in the same change. Book content (paper, frame styles, captions) takes its colors and fonts from the document, never from the UI theme.
- **UI ref.** An item with UI may carry a `UI ref: uikit#/feature/<slug>` line naming the UI kit screen it follows; the kit is the reference for layout, states and copy, the item's Browser check stays the acceptance test.

## Order, milestones, closing

- Items run in index order; `pnpm roadmap next` returns the first open item, skipping `[contingency]` items and slugs with an open PR.
- Milestones are review cuts. `done` writes `Status: done` in the item file and does not tick the index or archive. Index ticks (`pnpm roadmap sync`) and milestone `archive <M>` land through a small dedicated docs PR run by the operator/reviewer after item PRs merge (batched is fine) — never inside item PRs (`main` is protected; no direct pushes). `check` warnings for pending sync/archive are expected until that docs PR. Milestone IDs are stable labels referenced from docs and specs, so inserted milestones take fractional numbers (M2.1, M2.2, M2.5, M4.5) and a moved milestone keeps its number (M7 runs before M6).
- An item is closed in the change's own PR right after the OpenSpec archive with `pnpm roadmap done <slug>` (`openspec/config.yaml` `operations.archive`). `--note` records how it was closed. Parallel item PRs must not edit the same index checkbox line.
- Reprioritizing is the owner's call: `pnpm roadmap move`. Deferred ideas are scheduled with `pnpm roadmap add`.

## Change size

Every item fits one agent apply context (one agent chat) and one PR of about 1000 changed lines (1500 at most). This section is the SoT for the line-count target/max and the subsystem definition; `openspec/config.yaml` `rules.proposal` carries the one-subsystem and 8-task limits and points here for line counts. A proposal over budget is split in the roadmap before apply. The hard limit binds the plan and the first push (`pnpm agent size --plan`, `pnpm quality:self-check` / `pnpm agent finish`); review-fix pushes on an open PR only print the total (no hard fail).

**The roadmap grows in place.** If planning or apply shows that a PR will go over the size budget, add the overflow as a new item right after the current one: `pnpm roadmap add <kebab-slug> --after <current> --tag prep|feature --title "…"` (same milestone, short scope, a **Done when:** line for a `[prep]`); the current PR stays within the limit — never enlarge the PR past the budget. Review findings that are deferred (blocking critical/high left for later) become items right after the current one the same way, never vague follow-ups. Items are still done in index order; the list just gets longer.

- A **subsystem** is a unit with its own lifecycle or contract: a worker or worker pool, a store, a painter or render layer, a storage or cache adapter, a new dependency, a new Vite entry, a schema version bump, a new top-level UI region (screen, panel, overlay layer). A UI region with its own view state is one subsystem; a dependency or worker that exists only to implement the item's one subsystem counts with it.
- Not a subsystem: new job types on the existing worker pool, ops / selectors / slices on an existing store, wiring existing subsystems into UI, the change's own perf scenario.

Slicing rules when adding or splitting items:

1. A `[feature]` adds at most one subsystem. If it needs both new non-UI infrastructure and a new UI region, the infrastructure is a preceding `[prep]`.
2. A book schema version bump is its own `[prep]`; pure functions over the new fields may ride along.
3. A gate fallback with its own scope (another painter path, streaming output) is a `[contingency]` item. A stop-and-re-plan condition or an in-place implementation choice (for example, "move serialization to the worker if over budget") stays inline.
4. Each split `[feature]` keeps its own **Browser check:** line, and a **Perf:** line with a scenario when it adds an interaction or background work the editor must stay smooth during.
5. Split only for a new subsystem or the task limit; small adjacent work stays merged.
6. The item that owns a gate referenced in `docs/future-architecture.md` keeps its slug.

## Agent apply hygiene

- Tick item-file checkboxes with targeted edits; do not rewrite the whole item file.
- A failure is **out of scope** only when the same test also fails or flakes on unmodified `origin/main`. A test outside the touch-set that fails only with this change applied is **in scope** and must be fixed in code or tests in this PR. Out-of-scope failures are scheduled with `pnpm roadmap add <slug> --after <current>` (or a bug issue for a flake) and are not patched by enlarging this PR — but filing an item or issue never makes a red PR mergeable; the git-finish stop after 3 red CI rounds still applies.
- At most two **failed** local push attempts under pre-push; then stop and report in the PR description instead of looping. Code changed after implementation review must be re-reviewed before archive.

## Known limits

- Parallel PRs: two branches that `add` after the same item can conflict on the index; re-run `add` on a clean index after merge instead of hand-merging. Item `done` must not touch the index (Status in the item file only).
- Titles and tags live in both the index line and the item file; `check` requires them to match. There is no retitle command: the owner edits both lines together.
- LF line endings only (`.gitattributes` sets `eol=lf`); an index with CRLF line endings is not supported.
- Stale remote branches of merged items inflate `roadmap next --skip`; prune them on the owner side (do not fix by editing the index by hand).
