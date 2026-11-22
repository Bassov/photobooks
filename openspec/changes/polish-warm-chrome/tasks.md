## Implementation

- [x] 1. Kit + prod tokens to the P10 warm neutrals (`uikit/src/index.css`, `styles/tokens.css`).
- [x] 2. Prod literals (`editorChromeTokens.ts`, library styles, HostingSetup, SettingsScreen) and kit literals (demo parts, v7, context inspector, Shell, library) follow.
- [x] 3. Unit and e2e pins move to the new values; kit-tokens exempts exactly the P10 tones; `qa.mjs` `--t-bg` value.
- [x] 4. New `e2e/kit-warm-chrome.spec.ts` paint check (prod + kit, 1440×900).
- [x] 5. `docs/design.md` palette and the filmstrip spec dock tone.

## Manual test scenarios

1. Prod editor at 1440×900: top bar, panels and dock read warm grey; canvas behind the spread is the warm canvas; Preview / Settings pills are the warm field; paper stays white.
2. Library home and Settings: quiet search / sort fields and the selected nav row are warm; hover fills stay visible.

manual-qa 2026-11-22: problem (harness) — both scenarios blocked at the welcome `start-session` click (header intercepts pointer events), no colours measured. Evidence instead: `e2e/kit-warm-chrome.spec.ts` (prod + kit paint at 1440×900), `library-screens`, `printer-presets`, `frame-context-menu`, `settings-profile-fields` pins green locally.
