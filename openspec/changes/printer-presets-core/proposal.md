## Proposal

Roadmap: `docs/roadmap/P5/printer-presets-core.md` (SoT).

### Scope out

- All UI: items `printer-presets-kit` / `printer-presets`.
- Snapshot refresh on a custom-profile save; low-res callers passing customs: item `printer-presets`.

### Delta / Risk

- No web access, so no shop is sourced (D8): Generic only; the PR body names Lulu, Blurb, Saal Digital and CEWE as left out.
- Custom profiles and snapshots parse through the profile schema; invalid ones are dropped.
