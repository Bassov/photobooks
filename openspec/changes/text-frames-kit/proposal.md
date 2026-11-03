## Proposal

Roadmap SoT: `docs/roadmap/P2/text-frames-kit.md`. UI ref: `uikit#/demo`; Designer `text-frames/spec.md` "Kit changes".

### Scope out

- Prod (`src/`): items `text-frames-core` / `text-frames-editor`.
- Enter-to-edit, Esc-cancel and snap of a Text drag (kit frame draw has none).

### Delta / Risk

- Kit only, no spec delta. Observables: empty (new frame → `Type text`, Esc removes it), happy (Title → whole lines + `text-overflow-chip` + meta), interact (click create clamped; press over a photo). Scroll only inside the inspector textarea.
