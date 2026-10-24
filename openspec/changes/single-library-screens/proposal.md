## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Acceptance: `tasks.md`.
Size: owner-approved single PR (session single-handle + surface replace); no split.

### Scope out

- Photo import / folder-source durability (other agents).
- Theme / design-system restyle (placeholder UI only).
- Multi-theme or multi-photo-folder product work.

### Delta / Risk

- Security: single FSA `readwrite` library handle in IDB; `queryPermission` / `requestPermission` before picker; unsupported gate when picker/secure-context/mobile fails.
- UI e2e: unsupported, welcome, library empty+list (create/open/change/settings), editor→library; library scrollport only (no page H/V scroll).
