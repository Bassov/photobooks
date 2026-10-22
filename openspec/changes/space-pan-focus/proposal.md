## Proposal

QA PB-04 (no roadmap): Space+drag pan must work with chrome focus when not in a text input.

### Scope out

- Zoom keybindings or pinch/wheel changes
- Filmstrip/toolbar activation redesign beyond Space-pan arming
- New camera UI chrome

### Delta / Risk

- Space on focused buttons/links arms pan (`preventDefault`) instead of activating the control; text fields stay exempt.
- Empty: blank pasteboard still pans. Happy: Space+drag after chrome click. Interact: no page-level H/V scroll; pan only inside pasteboard scrollport.
