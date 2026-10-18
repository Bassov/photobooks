# continuous-zoom-settle-mount-pace

Tag: prep
Milestone: M2.1
Title: Pace pasteboard remounts on zoom-out settle to keep continuous-zoom LoAF green

## Scope

- [ ] When committed zoom shrinks the pasteboard stride, mounting many newly visible `ConnectedSpreadView`s in one frame must not produce LoAF (continuous zoom-out settle under CPU throttle)
- [ ] Prefer paced virtual-window expansion (cap new mounts per rAF) over looser budgets or retries
- **Done when:** `spread-view › continuous zoom` can assert zero LoAF across zoom-out settle/mount (not only burst+paint) at `--repeat-each=20 --retries=0`, budgets unchanged
- **Size:** ~400 changed lines
- **Source:** e2e-frame-budget-flakes phase-3 settle remount
