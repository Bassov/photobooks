## M2 — Project on disk

**Review cut:** the book survives reloads and browser restarts, a returning user finds recent libraries and their books on the home screen — and saving never causes a hitch. Book titles and photo metadata follow in M2.2, moved photo folders (`missing-assets-relink`) in M2.5.

- [x] [prep] [library-storage](library-storage.md) — book persistence contract
- [x] [prep] [library-storage-fsa](library-storage-fsa.md) — library on the file system
- [x] [prep] [session-state](session-state.md) — per-browser state
- [x] [prep] [asset-record-schema](asset-record-schema.md) — asset identity in the document
- [x] [prep] [asset-identity](asset-identity.md) — content-addressed assets
- [x] [prep] [derived-cache-opfs](derived-cache-opfs.md) — persistent preview cache
- [x] [feature] [open-save-project](open-save-project.md) — library on disk
- [x] [feature] [fix-open-save-adopt-hydrate](fix-open-save-adopt-hydrate.md) — adopt session work; durable preview hydrate
- [x] [feature] [autosave](autosave.md) — never lose work
- [x] [feature] [permissions-locks-ux](permissions-locks-ux.md) — access and single writer
- [x] [feature] [recents-home](recents-home.md) — returning user (hardening on PR #71: Home control, re-grant correctness, dedup, IDB/error/loading/busy, New library clean start)
