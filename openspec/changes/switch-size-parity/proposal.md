## Proposal

Roadmap: [`docs/roadmap/P2/switch-size-parity.md`](../../../docs/roadmap/P2/switch-size-parity.md) (scope / Done when / Browser check observables). UI ref: `uikit/src/components/ui/switch.tsx` `size="sm"`.

### Scope out

- Toggle colours, knob shadow, focus ring.
- Kit edits (`uikit/sandbox/v7.tsx` `Toggle` stays 32×18).
- Non-switch toggles (`ToggleButton`, top-bar panel toggles).

### Delta / Risk

- One `ToggleSwitch` CSS edit sizes every prod `role="switch"`; rows are `items-center` and ≥20 px tall, so row heights stay.
