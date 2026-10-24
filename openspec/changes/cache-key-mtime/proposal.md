## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Done when: derived caches keyed by path+size+mtime(+root); reload hydrates from OPFS without body reads or `hashContent`; no content-hash on import/reload/rescan.

### Scope out

- Folder-manifest IDB, EXIF thumbs/lazy HEIC, decode queue (later PRs)
- Skeletons / status-copy / content-visibility polish; roadmap edits

### Delta / Risk

- e2e: open-save reload/hydrate filmstrip+frames; filmstrip re-import. Scroll only inside filmstrip (and pasteboard when frames hydrate); no page H/V.
- Security: OPFS keys from folder metadata only (no new FSA trust); stale contentHash-keyed entries unused, regenerate once.
