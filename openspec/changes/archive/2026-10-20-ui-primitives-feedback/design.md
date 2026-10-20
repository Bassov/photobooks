## Decisions

1. **Thin RAC wrappers** in `src/ui/`: Status, Toast, Badge, ProgressBar, EmptyState, Dialog, AlertDialog, Popover, Menu. Plain CSS + Theme B tokens; reuse Button/Icon.
2. **Status** polite/assertive live regions. **Toast** = RAC UNSTABLE_ToastQueue/Region. **Badge** inventory colors/sizes/types + dot. **ProgressBar** determinate/`isIndeterminate`. **EmptyState** icon/title/description/actions.
3. **Overlays:** Dialog = ModalOverlay+Modal+Dialog. AlertDialog non-dismissable `alertdialog`; Cancel ghost autofocus; confirm Button `destructive` (`--destructive-solid` only here). Popover + Menu thin RAC wrappers; MenuItem `destructive` via `data-variant`.
4. `skip_specs: true`.

## Touch-set & Test Plan

- Files: `src/ui/{Status,Toast,toastQueue,Badge,ProgressBar,progressFill,EmptyState,Dialog,AlertDialog,Popover,Menu,Button,specimenFeedback,dialogOverlay,alertConfirm}.*`, SpecimenPage.*, e2e design-tokens, docs/design.md, roadmap item, archive.
- Tests: unit public props; e2e specimen feedback+overlays; ui-review.
