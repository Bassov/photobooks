---
name: roadmap
description: >-
  Photobooks roadmap through the CLI: pick the current item, grow the roadmap
  instead of the PR, close items on the change branch. Use for any task that
  starts from, adds to or closes a roadmap item.
---

# Roadmap CLI

`docs/roadmap.md` is an index (one line per item, order = priority); each item has its own file `docs/roadmap/<milestone>/<slug>.md`. One item = one OpenSpec change = one PR; the slug is the change name. Process doc for humans: `docs/roadmap/RULES.md`.

Run `pnpm -s roadmap <cmd>` (`-s` drops pnpm's banner; `--json` for JSON). Errors exit non-zero and change nothing.

## Pick

- `next [--slug S] --skip <claimed slugs>` prints the current item: slug, tag, milestone goal, title, file and full scope. Do not open the index or item file to find work. Claimed set includes open PRs, remote/local `feat|fix/*`, and worktree checkouts.
- `claim <slug>` validates an open slug for an explicit hold. `show <slug>` prints any active item. `list --open [--milestone M]` only for a real overview need.
- `next` skips `[contingency]`; work one only when its gate failed. Read a `Notes:` goal line's file once per milestone.

## Scope and size

- Scope = the item's nested checkboxes; tick them in the item file during apply (yours to edit; the index is not). Never pull scope from later items.
- `[prep]`: **Done when:** is the success criteria. `[feature]`: criteria cover **Browser check:** and **Perf:**; if missing, write them into the item file as an assumption.
- Budget (planning guidance, not a CI/merge blocker): one PR of ~1000 changed lines (prefer ≤1500), at most one new subsystem (worker, store, painter, storage/cache adapter, dependency, Vite entry, schema bump, top-level UI region), at most 8 tasks. C2 (`quality:self-check`) / CI warn on oversize (finish is thin).
- Over guidance, or a deferred review finding: prefer adding an item right after the current one and moving the overflow there:
  `add <kebab-slug> --after <current> --tag prep|feature --title "..." [--body-file scope.md]`
  Needed infra first as `[prep]`; a gate fallback with its own scope is `[contingency]`.

## Close

- Right after the OpenSpec archive, on the change branch: `done <slug> [--note "how it shipped"]` (writes `Status: done` in the item file; does **not** tick the index or retire the milestone).
- Unneeded `[contingency]`: `done <slug> --note "not needed (gate passed in <gate-item>)"` in the gate item's PR (note required).
- After item PRs merge: the operator/reviewer runs `sync` (and `archive <M>` when a milestone is fully done — **retire**: drop index block + delete `docs/roadmap/<M>/`; git history is SoT) in a small dedicated docs PR — never inside item PRs (`main` is protected). Batched sync/archive is fine. `check` warnings for pending sync are expected until then.
- `check` validates the layout (runs in `pnpm check:integrity`); fully-done-but-active is a warning until `archive`. Legacy `## Archive` / `docs/roadmap/archive/` are errors.

## Never

- Hand-edit `docs/roadmap.md` (ticks, order, wording) or delete item files.
- `move <slug> (--after S | --before S | --milestone M [--top|--bottom])` unless the owner asks to reprioritize.
- `done` an item other than the current PR's.
