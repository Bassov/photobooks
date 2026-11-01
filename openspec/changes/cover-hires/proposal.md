## Proposal

Roadmap: `docs/roadmap/P1/cover-hires.md` (scope / Done when / Browser SoT).

### Scope out

- Spreads-panel cover row (thumbs only, no tiers).
- Endpaper / inspector photo previews (stay on thumbs).
- Thumb-warm / decode-scheduler lanes.

### Delta / Risk

- Cover joins the shared tier display under its own slot; e2e: cover natural width = page frame's 1280, library tile = 1280, empty cover stays plain.
- Security: no new blob-URL lifecycle (existing create/revoke paths).
