## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Done when: IDB folder manifest (path/size/mtime + width/height/orientation) paints filmstrip slots + OPFS thumbs on reload before scan; every visit still cheap-walks and diffs; corrupt/version mismatch rebuilds; no freeze on 2–4k writes.

### Scope out

- EXIF thumbs / lazy HEIC / decode queue / WebP (later PRs); skeletons / status-copy / content-visibility
- Multi-folder roots; roadmap edits

### Delta / Risk

- e2e: open-save reload/hydrate; filmstrip list; new unit: manifest-before-scan, diff add/change/remove, corrupt fallback. Scroll only inside filmstrip; no page H/V.
- Security: IDB holds metadata only (no bodies/handles); same FSA `read` trust as today; corrupt rows ignored.
