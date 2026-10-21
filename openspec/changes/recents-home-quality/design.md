## Decisions

1. **Home a11y:** Brand stays visual; add a single screen `h1` (visually styled via existing heading tokens). Selected recent announced via polite live region (`home-selected-announce`). Headings stay plain `h2` without redundant `aria-*`. Busy: keep focus on the control that started the action (do not blur/move focus to chrome).
2. **Readable status:** `setStatus` error path uses `humanMessageForCode` (and deny/cancel-specific strings already set on `homeError`); never `Could not …: <code>`. Picker cancel vs permission deny stay distinct messages.
3. **Re-grant peek-failed:** If a target library id is known but peek fails, refuse the bare picker bind with a readable home/status error (do not attach an arbitrary folder). Target book after successful grant stays the existing pending-book load path.
4. **Test API:** Gate only on `import.meta.env.DEV` / `VITE_E2E`; remove `window.__photobooksE2e`.
5. **Empty-editor e2e:** Restore pasteboard scroll + disabled create/save asserts via Start editing from empty home (not cold chrome).

## Touch-set & Test Plan

- Files: `HomeScreen.tsx`/`.css`/`.test.tsx`, `projectSession.ts` (+ tests), `bookLockController.ts` (+ tests), `e2e/open-save.spec.ts`; delta `openspec/specs/editor-shell/`
- Reuse: `humanMessageForCode`, `Status`, `--ring` focus rings, uikit home screens
- Tests: HomeScreen RTL (empty/list/error/permission/busy/keyboard + announce/focus); reserved-key mutation via session contract helpers; projectSession status humanization + `__photobooksE2e` removal; open-save empty/happy + Start editing pasteboard-scroll; skill `ui-review` before push; no new PBT
