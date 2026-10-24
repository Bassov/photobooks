## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Done when: empty=grey/no-EXIF placeholder; happy=EXIF thumb+header dims before thumb320; scroll=off-screen HEIC unqueued, visible∪placed queues at visible; no page H/V—filmstrip scrollport only.

### Scope out

- Dual decode queue/cancel/adaptive pool/WebP one-decode→320+1280; libheif WASM
- Skeletons, status-copy, badges, content-visibility; roadmap edits

### Delta / Risk

- Security: ≤64KiB JPEG heads; no bodies in IDB; idle HEIC no background body-read.
- Without libheif, visible/placed HEIC stays placeholder.
