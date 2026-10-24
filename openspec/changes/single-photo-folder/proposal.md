## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). One durable photo folder per book; Chromium FSA folder-only import.

### Scope out

- Unsupported-browser full-screen gate (separate redesign PR)
- Directory drag-and-drop; consolidating originals into the library
- Book-schema `photoSourceRootId` (v4); session book→root + asset ids suffice

### Delta / Risk

- UI: empty + happy folder pick + re-grant e2e (directory-picker stubs); after import, no page-level H/V scroll and horizontal scroll only inside the filmstrip scrollport.
- Security: photo roots in IDB (`read`); `requestPermission` before new picker; library store unchanged.
