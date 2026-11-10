## Implementation

- [x] 1. M99: Print presets row actions on `outline` (hover `--accent` #CFCFCF) — `e2e/printer-presets.spec.ts` "row actions, the Default badge and the delete confirm paint like the kit".
- [x] 2. M100: `AlertDialog` kit layout, default trash tile, md buttons — `src/ui/AlertDialog.test.tsx`, same e2e.
- [x] 3. M101: `Badge` without the inset ring — same e2e; `docs/design.md` Badges line.

## Manual test scenarios

1. Settings → Print presets: hover Duplicate, New profile, Edit…; each turns #CFCFCF.
2. More → Delete… on the custom profile: trash tile, 21 px serif title, 36 px Cancel / Delete; Cancel closes it.
3. The Default badge has no outline ring.
4. Library → Change library folder (folder icon), Remove… (trash), filmstrip Remove a placed photo (trash by default): same confirm layout.

- problem (harness): `pnpm agent manual-qa` timed out on `start-session` at welcome (header intercepts the click) for all 4 scenarios; no product step reached. Evidence instead: 1–3 `e2e/printer-presets.spec.ts` "row actions, the Default badge and the delete confirm paint like the kit" (pixels + geometry, local pass); 4 `e2e/design-create-library-chrome.spec.ts` icon tiles + `src/ui/chromeParity.test.tsx`.
