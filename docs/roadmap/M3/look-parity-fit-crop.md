# look-parity-fit-crop

Tag: feature
Milestone: M3
Title: look parity: Fit & crop in the inspector

## Scope

Look parity, Phase A #3: Fit & crop section in the inspector (kit CropSection), crop chrome off the canvas.

- [ ] Section "Fit & crop" for a selected filled frame: Fill|Fit segmented (resets zoom/pan), Zoom slider 100–400% (dbl-click resets, ↑/↓ while hovered), Pan X/Y fields in %
- [ ] Slider B look: 3px #CACACA track, #A8A8A8 fill (#8E8E8E dragging), #F7F7F7 thumb with soft shadow; no black
- [ ] Crop button (outline, "Done" in ink while cropping) + ghost Reset to cover (disabled at cover); Esc/Done exits
- [ ] Active crop overlay: 2px #6b696a outline + "Crop · N%" tag on FIELD; black selection outline and handles hidden while cropping; no always-on crop chrome

**Done when:** crop is driven from the inspector only; no amber, blue or black crop ring.
**Browser check:** select a photo, Fit & crop shows; Crop → grey overlay + tag, Done/Esc exits; Fit shows the whole photo.
**Perf:** crop preview stays a transform in rAF; no new per-frame work.
