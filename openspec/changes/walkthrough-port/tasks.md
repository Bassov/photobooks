## Implementation

- [ ] 1. Route `#/guide[/<chapter>]`, `href.guide`, `main.tsx` dispatch + title
- [ ] 2. KitBar "Walkthrough" nav item (`data-nav="guide"`, no href)
- [ ] 3. Guide modules on main's tokens (GuidePage, Rich, Imposition, imposition copy)
- [ ] 4. Chapter copy updated to main: direct crop, filmstrip resize, copy / paste / duplicate, frame context menu + photo pick, placed badge, Fill book, layout cycle, interface size, cover PDF; changed labels and keys
- [ ] 5. `guide-shots.mjs` on the unchanged `demo-capture.mjs`; `guide:shots` script; figures + `shots.json` recaptured
- [ ] 6. `e2e/kit-guide.spec.ts`

## Manual test scenarios

1. Kit home → "Walkthrough" in the top bar → `#/guide` opens with the TOC; the item is current.
2. Click TOC "Print at home and bind" → chapter 16 under the bar; 4-up → sheets change, the "Cut across" step un-dims.
3. Scroll the whole guide: every figure shows; "Kit page: …" links open existing pages.
