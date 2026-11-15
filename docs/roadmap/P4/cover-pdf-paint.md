# cover-pdf-paint

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item cover-pdf-paint
Status: done

## Scope

- [x] `paintCoverPdf`: one cover PDF page per Designer cover-pdf Spec §2.5 (CP2, C3/C4/C6): boxes from `sheetBoxes` with the cover bleed, cloth `backFill` over the bleed box, front photo clipped to B', back / spine / front texts with the book fonts, crop + spine fold marks; streams like the interior
- [x] `coverSheetMarks` (crop marks + 4 spine fold marks) and the shared pure `coverPhotoRect` (CoverView places the front photo through it)
- [x] PDF worker `{ cover }` request → chunk / done `{ bytes, skipped }` / failed
- **Browser check:** none (no UI; the prod dialog is item `cover-pdf`); editor cover look unchanged.
- **UI ref:** none (core painter; Designer `cover-pdf` spec §2.5)
- **Done when:** unit + PBT green: A5 Generic marks-on TrimBox 958.11 × 680.31 pt at (22.68, 22.68), BleedBox 975.12 × 697.32, MediaBox 1003.46 × 725.67 (0.01 pt), marks off all three 958.11 × 680.31 at 0; cloth fill = `backFill`; spine text glyphs present; fold marks never inside the bleed box; `coverPhotoRect` always covers its box; worker cover round trip; existing cover tests pass untouched.
- **Kit components:** none
- **Demo:** n/a
- **Musts:** CP2
- **Hard nos:** no UI; no spine colour change; painting only in the PDF worker
- **Tokens:** n/a (print output)
- **Test:** unit + PBT; no e2e (no UI)
- **Depends:** pdf-captions
