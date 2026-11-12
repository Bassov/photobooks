## Proposal

Roadmap: [`docs/roadmap/P4/design-r23-delete-shadow.md`](../../../docs/roadmap/P4/design-r23-delete-shadow.md) (scope / Done when). UI ref: kit `uikit/src/components/ui/button.tsx` `destructive` variant.

### Scope out

- Kit (`uikit/`), menu `destructive` items, `destructive-ghost` / `-outline` styles.
- Other Button variants (default / secondary / outline / ghost) keep their shadows.

### Delta / Risk

- UI: happy = Delete-profile confirm Delete paints `--shadow-xs` at rest and hover; interact = pressed drops it to `none`; no empty or scroll state (modal only, no scrollport). Every `tone="destructive"` AlertDialog shares the class.
