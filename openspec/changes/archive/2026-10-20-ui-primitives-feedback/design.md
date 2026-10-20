## Decisions

1. **Thin presentational wrappers** in existing `src/ui/` (plain CSS + Theme B tokens; no Tailwind/uikit imports): Status, Toast (+ queue/region), Badge, ProgressBar, EmptyState. Reuse Icon / Button from actions.
2. **Status** = live region (`polite` → `role="status"` / `aria-live="polite"`; `assertive` → `role="alert"` / `aria-live="assertive"`). **Toast** = RAC `UNSTABLE_ToastQueue` / Region / Toast (kit recipe); tones `default` | `success` | `error`; optional action. Specimen mounts a region; product wiring later.
3. **Badge** colors `gray|brand|success|warning|error`, sizes `sm|md|lg`, type `badge-color|pill-color`, optional `dot` (token `--badge-*`). **ProgressBar** = RAC ProgressBar; determinate via `value`, indeterminate when value omitted. **EmptyState** = icon slot + title + description + actions slot.
4. `skip_specs: true` (`.skip-specs`). No new deps / cruiser rules. Button `destructive` deferred to overlays item (AlertDialog confirm).

## Touch-set & Test Plan

- Files: `src/ui/{Status,Toast,Badge,ProgressBar,EmptyState}.{tsx,css}`, SpecimenPage.*, unit tests; `.skip-specs`; roadmap items (feedback + overlays follow-on); optional `docs/design.md` note.
- Reuse: tokens, Icon/Button, kit as visual/a11y reference only (`src-no-uikit`).
- Tests: unit via public props (live-region politeness, toast queue+action+tone, badge attrs, progress value/indeterminate, EmptyState actions); e2e specimen feedback interact + empty/painter scrollports; `ui-review` before archive.
