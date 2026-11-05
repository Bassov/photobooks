## Implementation

- [x] 1. `e2e/fixtures/switchGeometry.ts`: kit `Switch sm` numbers and a helper checking track / knob boxes relative to the track plus knob paint (`expectKitSwitchSm`).
- [x] 2. `e2e/switch-size-parity.spec.ts`: Book settings Endpapers (on) and Skip first page (off) measure 36×20 / knob 16 at +2 / +18, both flipped, knob paint probe; Book settings row heights `[26.84, 18.84, 26.84, 26.84, 18.84, 26.84, 26.84, 18.84]` as measured before the change (both red on the old CSS: knob +16, rows 20 before the margin fix).
- [x] 3. `e2e/kit-live-captions.spec.ts` "the Live switch is the Switch sm 36×20 off and on": the `#/demo` Live switch passes the same helper.
- [x] 4. `src/editor/InspectorControls.css`: `.insp-toggle` 36×20 with `margin-block: -1px` (lays out as 18 px, rows keep 18.84), knob 16 px at 2 px inset, checked left 18 px.

## Manual test scenarios

1. Editor → Book settings: Endpapers (on) and Skip first page (off) toggles are 36×20 with a 16 px knob at the right / left end; clicking each moves the knob 16 px; row heights unchanged.
   - problem (harness): `pnpm agent manual-qa` ok:false — the welcome `start-session` click is intercepted by the welcome header (known manual-qa welcome block), editor never opened. Covered by e2e instead: `e2e/switch-size-parity.spec.ts` (track 36×20, knob 16×16 at +2/+2 off and +18/+2 on ±0.5, knob paint, rows unchanged) and the kit twin in `e2e/kit-live-captions.spec.ts`, both green locally.
