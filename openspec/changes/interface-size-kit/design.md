## Decisions

1. Session `uiScale: 100 | 125 | 150` (default 100). `effectiveUiScale` in `session.tsx` = D4 (largest step ≤ choice leaving the app ≥ 1280×720, else 100), never written back.
2. `useStageScale` measures the stage: `demo-root` measures its parent, `#/demo` measures the window. The stage gets `zoom` only when s ≠ 100 (IS10), and `#/demo` divides its vw/vh box by it. `UiScaleCtx` passes the effective scale to Settings, which shows the clamp hint when effective < choice.
3. The row reuses kit `Segmented` md at `w-56`, with the Site `LABEL` / `HINT` classes. Focus-visible keeps the kit Toggle ring (`components/ui` is out of scope).
4. The new demo-capture step shifts the unsupported-* shot numbers by one. The PR body says so; no baseline is regenerated.

## Touch-set & Test Plan

| Path                                    | Why                                |
| --------------------------------------- | ---------------------------------- |
| `uikit/src/demo-parts/session.tsx`      | `uiScale`, D4, stage hook, context |
| `uikit/src/demo-parts/settings.tsx`     | §1 section replaces stub rows      |
| `uikit/src/demo-parts/root.tsx`         | `demo-root` zoom, focus seed       |
| `uikit/src/features/demo.tsx`           | `#/demo` zoom                      |
| `uikit/src/features/pages.tsx`          | two scenarios                      |
| `uikit/scripts/demo-capture.mjs`        | step `settings-interface`          |
| `e2e/kit-interface-size.spec.ts`        | new e2e                            |
| `docs/roadmap/P5/interface-size-kit.md` | item scope                         |

- Reuse: `Segmented`, `settingsAt`, `paintProbe.topAt`.
- Tests: e2e only (no kit unit lane); existing `e2e/kit-*` stay green.
