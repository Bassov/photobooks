# ui-primitives-forms

Tag: prep
Milestone: P1
Title: form primitives in `src/ui/`

## Scope

- [ ] NumberField with mm units and step / shift-step, TextField, Checkbox, Select, field groups; every state; specimen section and baselines
- **Kit components:** none (no matching component); kit primitives: `uikit/src/components/ui/numberfield.tsx`, `uikit/src/components/ui/textfield.tsx`, `uikit/src/components/ui/checkbox.tsx`, `uikit/src/components/ui/select.tsx`
- **Demo:** n/a (primitives; shown via `?specimen`)
- **Musts:** every state in `?specimen`
- **Hard nos:** no blue focus rings
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** specimen baselines + unit tests
- **Depends:** none
