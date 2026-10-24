## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap).

### Scope out

- Multi-folder / multi-theme screens (other agents)
- UI-kit placeholder redesign (keep current primitives)
- Roadmap edits / new capability modules

### Delta / Risk

- Owner cut: thumb 320 + working 1280 only; drop 640/2560; zoom >1280 soft OK.
- Also: worker `createImageBitmap` resize; filmstrip∪spread visible priority; decode pool cap ≤4.
- Empty/happy/scroll: placeholder→thumb→1280; filmstrip scrollport only.
- Security: workers/postMessage; revoke blob URLs on eviction.
