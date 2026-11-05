## Decisions

1. Reference is the kit `Switch size="sm"` (Designer note on #491; it is the `#/demo` Live caption switch): track 36×20 border-box, knob 16×16 at 2 px inset (off left 2, on left 18). Prod keeps its markup (`button[role=switch]` + absolute knob span); only `InspectorControls.css` changes (`.insp-toggle` 2.25rem × 1.25rem, knob 1rem at 2px, checked left 18px). The inset reproduces the kit's transparent border; colours and transition stay. `margin-block: -1px` lays the 20 px track out as the old 18 px one, so its 18.84 px rows (text line) keep their height and nothing below moves.
2. All callers render `ToggleSwitch`; no other `role="switch"` in `src/`.
3. One e2e fixture holds the kit numbers and the measure for both the kit and the prod test, so kit drift fails the kit test.
4. Tokens: none new; `docs/design.md` untouched (kit parity only, file off limits for this lane). Skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                    | Why                                  |
| --------------------------------------- | ------------------------------------ |
| `src/editor/InspectorControls.css`      | track / knob size and checked offset |
| `e2e/fixtures/switchGeometry.ts`        | kit `Switch sm` numbers + measure    |
| `e2e/switch-size-parity.spec.ts`        | prod toggles off / on, row heights   |
| `e2e/kit-live-captions.spec.ts`         | kit `#/demo` Live switch off / on    |
| `docs/roadmap/P2/switch-size-parity.md` | stub item filled from the brief      |

- Reuse: `e2e/fixtures/paintProbe.ts` `pixelsAt`; book-cover spec setup.
- Tests (e2e; pure CSS): track 36×20, knob 16 at +2 / +18 ±0.5, knob paint vs free slot; Book settings row heights hard-coded to the values measured before the CSS change.
