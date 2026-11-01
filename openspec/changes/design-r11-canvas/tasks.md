## Implementation

- [x] 1. M73: canvas spine fold (3 % kit gradient, world-scaled) replaces the 1 px cut; thumbs keep the hairline.
- [x] 2. M74: `--cover-shadow-mini` on the list Cover / Endpaper minis.
- [x] 3. M75: cover title / spine / back cqw sizes and weight 400, upright `Lora Cover` alias, kit label cell.
- [x] 4. e2e `design-r11-canvas.spec.ts` with kit values; r7 M51 fold width updated (Owner design change, round 11, M73); spread-view spec delta; `docs/design.md`.

## Manual test scenarios

1. 1440 × 900, 19 × 23 book: an interior spread at Fit and 200 % shows the soft fold centred on the spine; a ctrl-wheel zoom keeps it locked.
2. The list Cover and Endpaper thumbnails show only the small shadow.
3. The cover with title "Lake trip 2026": title, spine and back type and the Back / Spine / Front labels match `uikit#/demo` `editor-cover-photo-and-title`.

manual-qa: problems 1–3 are a harness problem (not reached). The `start-session` click times out because the welcome header intercepts it, before any step runs. Covered by `e2e/design-r11-canvas.spec.ts` (M73 Fit and ×2, M74 thumbnails, M75 at Fit and ×2), all passed.
