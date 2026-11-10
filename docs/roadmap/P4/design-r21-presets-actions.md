# design-r21-presets-actions

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r21-presets-actions
Status: done

## Scope

- [ ] M99: Print presets Duplicate / New profile / Edit… hover paints the kit `--accent` #CFCFCF (rgb 207), not rgb 216 (`PrintPresetsSection` buttons move to the kit `outline` variant).
- [ ] M100: the shared `AlertDialog` matches the kit destructive confirm: leading trash tile by default, Lora 21 px title, Cancel / confirm 36 px high with 0 16 padding, 420 px wide; every caller listed in the PR.
- [ ] M101: `Badge` paints no inset ring (kit P2-8): the Default badge edge is the tint (≈ 211), not 195; all variants checked against the kit.
- **Done when:** e2e paint checks in `e2e/printer-presets.spec.ts`: hover pixel 207, delete confirm trash tile + 21 px title + 36 px buttons with 0 16 padding, Default badge edge ≈ 211 with no ring. No `uikit/` edits.
- **Browser check:** Settings → Print presets: hover the row actions, open Delete… on a custom profile, look at the Default badge.
