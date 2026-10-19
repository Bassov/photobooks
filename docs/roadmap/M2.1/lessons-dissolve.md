# lessons-dissolve

Tag: prep
Milestone: M2.1
Title: Dissolve docs/lessons.md: repeat findings become checks or specs (issue #78)
Status: done

## Scope

- [x] Remove `docs/lessons.md`; replace the "append a lesson" mandate with: a repeated review finding MUST become an automated check (lint rule, test, shared helper, `verify` script) in the same change; only if a check is not feasible, a SHALL in the owning `openspec/specs/<area>/spec.md` or a code-site comment
- [x] Migrate all 24 lines per the #78 table. The two gate lines go to the quality bar only and point at their mechanical owners: the #76 line ("do not weaken … No Stryker disable until …") → `gate-ratchet`, `gate-weakening-guard`, `stryker-disable-budget` (stricter e2e helper/tolerance ratchet lives in `docs/backlog/e2e-assertion-ratchet.md`); the #82 line ("no Stryker exclude for a file this change modifies") → `stryker-diff-gate` / `exclusions-registry`
- [x] Update `openspec/config.yaml` (quality bar, doc budget, apply guidance), `openspec/specs/agent-context/spec.md` (replace "Lessons journal" requirement), `AGENTS.md`, `docs/future-architecture.md`, the implementation reviewer (`[lesson]` → `[repeat]` naming the check to add), and roadmap items that mention lessons
- [x] Over budget → growth rule: gotchas that need a new test (e.g. `input.files` copy, `useSyncExternalStore` snapshot stability) become the next checkbox
- **Done when:** `docs/lessons.md` is gone, `rg -i lessons` finds no live reference outside archives, and the PR body lists each of the 24 rules as deleted (verified duplicate), enforced by a named check, or stated in a named spec.
- **Size:** ~900 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #78

## Done note

Journal removed; 24 lines disposed in PR body; gate lines are pointers only; owner-requested rules-dedup added after.
