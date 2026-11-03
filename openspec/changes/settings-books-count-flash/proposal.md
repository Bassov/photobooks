## Proposal

Roadmap: [settings-books-count-flash](../../../docs/roadmap/P2/settings-books-count-flash.md) (SoT).

### Scope out

- Library header count (never shows 0) and `photoRootSession` (no UI).
- No skeletons or spinners: reuse the Preview cache "—".

### Delta / Risk

- e2e: real 0 shows "0"; editor → Settings never shows "0" and ends at "1"; gear press opens Settings.
- Listing failure now shows "—", not "0".
