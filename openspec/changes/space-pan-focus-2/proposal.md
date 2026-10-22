## Proposal

QA PB-04 after #182 (no roadmap): Space+drag must pan when the pointer is over the pasteboard after a filmstrip tile click; Space must still activate tiles when the pointer is not over the pasteboard.

### Scope out

- Zoom / pinch / wheel behavior
- Filmstrip selection UX beyond Space vs pan
- New camera chrome

### Delta / Risk

- Space arming keys off pasteboard pointer hover (capture-phase) so react-aria filmstrip rows no longer swallow pan; radios/tiles keep keyboard Space when pointer is off the pasteboard.
- Empty: blank pasteboard still pans. Happy: Space+drag after filmstrip click with pointer on pasteboard. Interact: no page-level H/V scroll; pan only inside pasteboard scrollport.
