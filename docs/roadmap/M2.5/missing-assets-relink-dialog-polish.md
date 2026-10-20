# missing-assets-relink-dialog-polish

Tag: feature
Milestone: M2.5
Title: relink dialog UI polish

## Scope

- [ ] Full uikit RelinkDialog parity (tabs density, Locate/Use-new polish, progress chrome) without regression on worker rescan/match
- **Browser check:** empty / happy rescan+Resolve / filmstrip scroll during rescan still pass
- **Perf:** zero LoAF while rescanning; dialog list remains the only overflow scrollport
- **UI ref:** `uikit#/feature/missing-assets-relink`
