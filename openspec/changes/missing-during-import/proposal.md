## Proposal

Off-roadmap bug fix (owner repro 2026-10-25): suppress Missing/Rescan UI during active first folder import. Acceptance: `.fix-task.md`.

### Scope out

- Rescan/relink Locate / Use new version polish
- Changing batch size or import throughput
- Roadmap index edits

### Delta / Risk

- Hold `importRunning` across multi-batch folder import so list-first placeholders are not treated as missing between 16-file waves.
- UI: empty filmstrip → import progress only (no Missing dialog/pill); idle + truly absent Files still open relink.
