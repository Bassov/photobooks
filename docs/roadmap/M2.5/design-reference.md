# design-reference

Tag: prep
Milestone: M2.5
Title: visual language and agent rule
Status: done

## Scope

- [x] `docs/design.md`: principles (photo is the visual anchor, neutral chrome, density, one primary action per view), visual direction (from the UI kit in `uikit/`), type / spacing / radius / elevation / z-layer / motion scales, semantic color roles, iconography rules, copy tone, dark-mode policy, editor-chrome vs book-content boundary
- [x] Component inventory: each primitive with its variants and required states (default / hover / focus-visible / pressed / selected / disabled / loading / error); empty / loading / error patterns
- [x] Audit of the current UI (`src/**/*.css` hardcoded colors, sizes, radii; duplicated button styles; the M2 screens — home, permission and lock messages, save indicator, missing-assets view) as the migration checklist for this milestone
- [x] `openspec/config.yaml` UI-in-scope mandate: use tokens and primitives from `docs/design.md`; new ones are added to it in the same change. `ui-review` gains a design-system gate; `openspec-planning-reviewer` checks design.md names the tokens/primitives used; `.cursor/rules/design.mdc` (globs `src/**/*.{css,tsx}`, not alwaysApply) points to `docs/design.md`; `AGENTS.md` map line
- [x] Each primitive and pattern names the UI kit screen it follows; where the kit and the current UI differ, the kit wins and the audit lists the gap
- **Done when:** `docs/design.md` is the visual SoT (principles, Theme B scales/roles, inventory + states, migration audit with kit-wins gaps); agents must follow it via `openspec/config.yaml`, `ui-review`, planning-reviewer, and `.cursor/rules/design.mdc`; `AGENTS.md` maps it. Assumption: Done when was missing from the item and was derived from the M2.5 Review cut (docs/rules only; no `src/` migration in this PR).

## Done note

docs/design.md SoT + agent gates (ui-review, planning-reviewer, design.mdc); skip_specs; no src migration
