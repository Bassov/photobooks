## Implementation

- [ ] 1. `MiniSpread` `page?: "l" | "r"`: clip to that page, no centre fold.
- [ ] 2. `SiteViewer` first slide `page="r"`, last slide `page="l"`; drop the wrapper clip.
- [ ] 3. `e2e/kit-preview-fold-strip.spec.ts`: paint probe of slide 1 left edge, last slide right edge, lightbox slide 1, two-page fold kept.

## Manual test scenarios

1. `#/demo` → create a book → Preview → →: Page 1's left edge shows no grey strip; → shows Pages 2–3 with the centre hairline; End: the last page's right edge is clean; Fullscreen on Page 1: no strip.
