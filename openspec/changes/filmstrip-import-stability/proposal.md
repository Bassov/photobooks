## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Done when: scroll mid-import keeps revealed tiles; mid-import reload restores imported/book-used tiles then continues import.

### Scope out

- List-first / hash deferral (P2)
- Roadmap edits; new visual system; multi-folder import

### Delta / Risk

- No page H/V scroll; only filmstrip scrollport. e2e: empty; import happy; scroll keeps revealed ids; reload restores book-used then continues.
- Security: reuse photo-root IDB + FSA `read` restore; no new picker.
