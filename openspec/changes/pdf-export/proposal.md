## Proposal

Roadmap: `docs/roadmap/P4/pdf-export.md`; Designer Spec pdf-export (PE8–PE10) wins. UI ref: `uikit#/feature/pdf-export`.

### Scope out

- 2-up / 4-up imposition, Cancel, download / save picker.
- `pdf-streaming` (only if 40-spread peak memory exceeds the threshold).

### Delta / Risk

- e2e: empty (pill disabled), happy (Export → Hide → pill → done → Open PDF), denied write → Try again; no page-level H/V scroll, the Check list scrolls inside itself.
- Security: library handle already readwrite; blob URL revoked after 60 s, `_blank` with opener cut.
