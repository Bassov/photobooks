# prod-smoke

Tag: prep
Milestone: M2.1
Title: production check after every deploy (#50 item 9)

## Scope

- [ ] Expose the build SHA (`/version.json`). `.github/workflows/prod-smoke.yml` on `push` to `main`: wait until production serves that SHA, then run a read-only `@smoke` subset (load, import fixtures, place, swap, unplace, no console errors) against production
- [ ] A red result opens an issue. `.cursor/commands/next-roadmap-item.md`: an open prod-smoke issue becomes the next checkbox before anything else
- **Done when:** every merge to `main` gets a smoke result within ~10 minutes, and a failure opens an issue that the next agent run fixes first.
