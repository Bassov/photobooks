## Implementation

- [ ] 1. `store.tsx`: `View.thumb` number | "auto", helpers (auto / max / clamp / snap), v2 storage read + write, `useThumbH`.
- [ ] 2. `chrome.tsx` `Filmstrip`: thumbs, filename strip and empty-state row use `useThumbH()`.
- [ ] 3. `chrome.tsx` `Dock`: separator (aria, pointer drag, keys, double-click, hover line, pill, chip); panel-b clips only while collapsed.
- [ ] 4. `e2e/kit-filmstrip-resize.spec.ts`: Done-when checks incl. `elementsFromPoint` paint.

## Manual test scenarios

1. Kit `#/demo` editor 1440 × 900: hover the dock top edge (pill), drag up 52 px (chip "128 px"), release (chip gone), double-click (back to 76).
