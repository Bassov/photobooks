## Proposal

Roadmap: [`docs/roadmap/P2/kit-sync-chrome.md`](../../../docs/roadmap/P2/kit-sync-chrome.md). UI ref: `uikit#/demo`; kit-sync Spec KS1, KS8, KS14.

### Scope out

- `src/` (read only) and kit lanes `canvas.tsx`, `viewport.tsx`, inspector files, `index.css`, `v7.tsx`.
- The site viewer (stays behind Publish → Open site). `skip_specs: true`: kit-only.

### Delta / Risk

- Bg copies prod `#0d0d0d` (rgb 13, not the brief's 0).
- Observables: spread list ends without Add spread; Preview opens fixed (no page scroll) on the cover; → / Esc.
