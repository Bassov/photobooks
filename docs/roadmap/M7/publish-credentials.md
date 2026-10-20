# publish-credentials

Tag: feature
Milestone: M7
Title: connect the editor to your hosting (Security Review)

## Scope

- [ ] Locally stored, narrowly scoped credentials, entered from the existing export menu (no new panel); strict CSP
- **Browser check:** enter credentials once; they survive a reload and are never sent anywhere except the hosting API.
- **UI ref:** `uikit#/feature/publish-credentials`
- **UI kit:** `uikit/src/features/m5m7.tsx:329-332` (`publish-credentials` demo + notes), `UI ref: uikit#/feature/publish-credentials` — hosting credentials form + states, `uikit/src/components/ui/textfield.tsx`, `uikit/src/components/ui/button.tsx`
