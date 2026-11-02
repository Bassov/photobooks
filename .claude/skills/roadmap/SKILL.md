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
- `[lite]` (`next --tag lite`): small, no new domain behavior; no OpenSpec change/archive, see `docs/agent-loop.md` Stage 1.
- `next` skips `[contingency]`; work one only when its gate failed. Read a `Notes:` goal line's file once per milestone.

## Scope and size

- Scope = the item's nested checkboxes; tick them in the item file during apply (yours to edit; the index changes only through the CLI). Never pull scope from later items.
- `[prep]`: **Done when:** is the success criteria. `[feature]`: criteria cover **Browser check:** and **Perf:**; if missing, write them into the item file as an assumption.
- Budget (planning guidance, not a CI/merge blocker): one PR of ~1000 changed lines (prefer ≤1500), at most one new subsystem (worker, store, painter, storage/cache adapter, dependency, Vite entry, schema bump, top-level UI region), at most 8 tasks. C2 (`quality:self-check`) / CI warn on oversize (finish is thin).
- Over guidance, or a deferred review finding: prefer adding an item right after the current one and moving the overflow there:
  `add <kebab-slug> --after <current> --tag prep|feature --title "..." [--body-file scope.md]`
  Needed infra first as `[prep]`; a gate fallback with its own scope is `[contingency]`.

## Close

- The item PR closes its own item. Right after the OpenSpec archive, on the change branch: `done <slug> [--note "how it shipped"]`, then `sync` (ticks `[x]` on its index line). Commit both with the archive, so `main` never has a merged item that is still open.
- Unneeded `[contingency]`: `done <slug> --note "not needed (gate passed in <gate-item>)"` + `sync` in the gate item's PR (note required).
- Index conflict with a sibling PR (parallel items, adjacent tick lines): keep every line from both sides, `[x]` wins over `[ ]`, then `sync && check`. Never drop a line or an `add`.
- `archive <M>` (**retire**: drop index block + delete `docs/roadmap/<M>/`; git history is SoT) stays an owner step at the milestone review cut, in a small docs PR. Until then `check` warns that the milestone is fully done.
- `check` validates the layout (runs in `pnpm check:integrity`); fully-done-but-active is a warning until `archive`. Legacy `## Archive` / `docs/roadmap/archive/` are errors.

## Never

- Hand-edit `docs/roadmap.md` (ticks, order, wording) or delete item files; the one exception is the tick-conflict merge above.
- `move <slug> (--after S | --before S | --milestone M [--top|--bottom])` unless the owner asks to reprioritize.
- `done` an item other than the current PR's (`sync` ticking already-done siblings is fine).
