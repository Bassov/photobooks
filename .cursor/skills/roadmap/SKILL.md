---
name: roadmap
description: >-
  Photobooks roadmap through the CLI: pick the current item, grow the roadmap
  instead of the PR, close items on the change branch. Use for any task that
  starts from, adds to or closes a roadmap item.
---

# Roadmap CLI

`docs/roadmap.md` is an index (one line per item, order = priority); each item has its own file `docs/roadmap/<milestone>/<slug>.md`; finished milestones move to `docs/roadmap/archive/`. One item = one OpenSpec change = one PR; the slug is the change name. Process doc for humans: `docs/roadmap/RULES.md`.

Run `pnpm -s roadmap <cmd>` (`-s` drops pnpm's banner; `--json` for JSON). Errors exit non-zero and change nothing.

## Pick

- `next [--slug S] --skip <claimed slugs>` prints the current item: slug, tag, milestone goal, title, file and full scope. Do not open the index or item file to find work. Claimed set includes open PRs, remote/local `feat|fix/*`, and worktree checkouts.
- `claim <slug>` validates an open slug for an explicit hold. `show <slug>` prints any item, archived too. `list --open [--milestone M]` only for a real overview need.
- `next` skips `[contingency]`; work one only when its gate failed. Read a `Notes:` goal line's file once per milestone.

## Scope and size

- Scope = the item's nested checkboxes; tick them in the item file during apply (yours to edit; the index is not). Never pull scope from later items.
- `[prep]`: **Done when:** is the success criteria. `[feature]`: criteria cover **Browser check:** and **Perf:**; if missing, write them into the item file as an assumption.
- Budget: one PR of ~1000 changed lines (1500 max), at most one new subsystem (worker, store, painter, storage/cache adapter, dependency, Vite entry, schema bump, top-level UI region), at most 8 tasks.
- Over budget, or a deferred review finding: add an item right after the current one and move the overflow there:
  `add <kebab-slug> --after <current> --tag prep|feature --title "..." [--body-file scope.md]`
  Needed infra first as `[prep]`; a gate fallback with its own scope is `[contingency]`.

## Close

- Right after the OpenSpec archive, on the change branch: `done <slug> [--note "how it shipped"]` (writes `Status: done` in the item file; does **not** tick the index or archive the milestone).
- Unneeded `[contingency]`: `done <slug> --note "not needed (gate passed in <gate-item>)"` in the gate item's PR (note required).
- After merge on `main`: `sync` ticks index checkboxes from item-file Status; when a milestone is fully done, `archive <M>` moves it (separate post-merge step).
- `check` validates the layout (also runs in `pnpm test`); fully-done-but-active is a warning until `archive`.

## Never

- Hand-edit `docs/roadmap.md` (ticks, order, wording) or delete item files.
- `move <slug> (--after S | --before S | --milestone M [--top|--bottom])` unless the owner asks to reprioritize.
- `done` an item other than the current PR's.
