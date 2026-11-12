## Decisions

1. `HostingSection` (new `hosting.tsx`): form, connected card, help, forget AlertDialog. Stored record = session `hosting` (`HostingRecord | null`, default connected sample). Scenario seeds (draft, frozen checking, CORS, replace, forget) come via `RootInit.settings.hosting`, like `print`.
2. Validation, the simulated 900 ms check and the width-stable label swaps (both labels in one grid cell) follow the Spec.
3. Security: the secret input is uncontrolled (no `value` attribute, never in state); no `name`, no `<form>`. After Connect only `accessKeyTail` is kept.
4. Primitives: kit `Button`, `Badge` (dot), `AlertDialog` (destructive), Settings row / rule / eyebrow, profile-editor `BOX` + `ring()`; tokens `bg-chrome`, `bg-field`, `shadow-xs`. Skill `ui-review` runs before push.
5. PublishDialog reads the host of `hosting.publicBaseUrl` from the session.

## Touch-set & Test Plan

| File                                     | Why                   |
| ---------------------------------------- | --------------------- |
| `uikit/src/demo-parts/hosting.tsx`       | new section           |
| `uikit/src/demo-parts/settings.tsx`      | hosting branch        |
| `uikit/src/demo-parts/session.tsx`       | `hosting` state       |
| `uikit/src/demo-parts/root.tsx`          | seed                  |
| `uikit/src/demo-parts/printProfiles.tsx` | export `BOX` / `ring` |
| `uikit/src/demo-parts/dialogs.tsx`       | host                  |
| `uikit/src/features/pages.tsx`           | scenarios             |
| `e2e/kit-hosting-settings.spec.ts`       | KM1–KM3               |

- Tests (e2e): nav order, field order and Spec geometry, errors as you type, Connect disabled until valid, Checking… width + readOnly, connected rows / badges, Replace → Cancel, Forget → empty form, CORS step 3 + Copy, PublishDialog host, secret absent after Connect, error-ring paint.
