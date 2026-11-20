## Proposal

Roadmap: `docs/roadmap/P5/site-cover-title-font.md` (scope / Done when / Browser check).

### Scope out

- Spine / shelf titles (D38: front only).
- Title page, type scale, tracking, radius.
- Persisting the kit Title font select.

### Delta / Risk

- e2e: Preview cover title paints Lora italic (happy); `sans` keeps the site sans; the GL front panel draws the same face.
- Security: `titleFont` is a closed enum mapped through a fixed table; unknown or missing → site sans, never raw CSS.
