## Implementation

- [x] 1. `src/ui/Dialog.css`: `.pb-dialog-overlay` gets `zoom: var(--ui-scale)`. Evidence: `e2e/interface-size-modals.spec.ts` Create book / Print / AlertDialog = R(s).
- [x] 2. `src/ui/Toast.css`: `.pb-toast-region` gets `zoom: var(--ui-scale)`. Evidence: `e2e/interface-size-modals.spec.ts` toast = R(s).
- [x] 3. New `e2e/interface-size-modals.spec.ts`: Create book, Print, AlertDialog and a toast at 3840×2160 with s = 1.25 / 1.5 = R(s) ±0.5 px, inside the viewport, dialog on top at its centre (8 passed).

## Manual test scenarios

1. 3840×2160, `localStorage["photobooks.ui.scale.v1"] = "150"`: Library → Create book: the dialog is 1.5× larger and centred.
2. Same window, editor → Print: the Print dialog is 1.5× larger and centred.
3. Library → book menu → Remove…: the confirm is 1.5× larger and centred.
4. No key (100 %): the dialogs look as before.
