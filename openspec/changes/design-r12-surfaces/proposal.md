## Proposal

Roadmap: [docs/roadmap/P1/design-r12-surfaces.md](../../../docs/roadmap/P1/design-r12-surfaces.md).

### Scope out

- Photo inspector / crop (design-r12-inspector); cover / endpaper image loading.
- Non-menu popovers (`src/ui/Popover`).

### Delta / Risk

- No spec delta. Shared `MenuPopover` offset 6 → 4 and no default min-width affect every menu (kit `Popover` for all).
- e2e: empty = cover with no photo, book without photos; happy = Fit / ×2 values; interact = select rows, open menus.
