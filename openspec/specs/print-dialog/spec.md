# print-dialog Specification

## Purpose

Top-bar Print job pill and the Print dialog: options with the print check, the PDF run in the PDF worker, and the written file in the library's `exports/` folder. Painting and checks live in `src/core/pdf/`; the UI and job store in `src/editor/print/`.

## Requirements

### Requirement: Top bar Print pill

The editor top bar SHALL show an icon-only Print job pill between Export site and Publish, 40 × 32 in every state: rest (Printer, title "Print"), running (Printer over a `--control` fill scaled to the percent, title "Exporting PDF · {p}%"), done (CircleCheck, "PDF ready", for 4 s) and failed (warning, "PDF not exported", until the dialog is opened). It SHALL be disabled while idle when the book has no spreads or the library is locked elsewhere, and clicking it SHALL open the Print dialog in the run's current step. The Export site label SHALL hide below 1424 px.

### Requirement: Print dialog

The Print dialog SHALL show the page size, the printer profile, an "Imposition (duplex)" segmented control (1 per sheet, default; 2-up; 4-up), an "Add {b} mm bleed and crop marks" checkbox (default on), the summary `PDF · {pages} pages[ on {sheets} sheets] · bleed {b} mm | · trim size, no marks` (2-up / 4-up: `sheets` = paper sheets, 4 / 8 book pages each) and a Check block filled by the PDF worker's `check` request (checking, clean, issues), which never disables Export PDF. Export PDF SHALL paint the book as it is at the click in the PDF worker and write `<library>/exports/{pdfFileName}` (2-up / 4-up add `-2up` / `-4up`); the run SHALL show "Page {i} of {sheets} · {p}%" and can be hidden while editing continues. A 2-up / 4-up run SHALL paint one PDF page per book page without the profile's blank padding, then impose it in the PDF worker ("Imposing sheets · {i} of {n} · {p}%"), writing two PDF pages (front, back) per paper sheet.

#### Scenario: PDF ready

- **WHEN** the export finishes
- **THEN** the dialog shows "{file} · {sheets} pages · {MB} MB", "Saved in {library}/exports." and Open PDF, which opens the written file in a new tab

#### Scenario: Booklet ready

- **WHEN** a 2-up or 4-up export finishes
- **THEN** the dialog shows "{file} · {n} sheets · {MB} MB" and the duplex instructions: 2-up flips on the short edge, then stack, fold and staple; 4-up flips on the long edge, then cut across, put the top half on the bottom half, fold and staple

#### Scenario: Write denied

- **WHEN** the library folder refuses the write
- **THEN** the dialog shows "PDF not exported" with the access text and Try again repeats the same export

### Requirement: Cover check rules

When the caller asks for the cover check with the 1 per sheet layout, the print preflight SHALL add cover rules after the interior ones: front photo missing / modified / below the profile's min or warn ppi (only the worse) / not sRGB, spine text below the profile's minimum font size or longer than trimH − 2·safe, and an info row for an empty front. Cover rows SHALL have scope `cover` and no page list; booklet layouts and callers that do not ask get none. The cover PDF SHALL be named `{pdfFileName stem}-cover.pdf`.

#### Scenario: Low-resolution front photo

- **WHEN** the front photo prints below the profile's min ppi on a 1 per sheet check
- **THEN** one error row reads "Front cover photo is {ppi} ppi, below {min} ppi" with scope `cover` and no pages

### Requirement: Cover PDF page

The PDF worker's `cover` request SHALL paint one PDF page of the book's cover sheet (`coverGeometry`, effective profile), titled with the book title and streamed as chunks, then `done { bytes, skipped }` or `failed`. With marks the boxes SHALL be `sheetBoxes(sheetW, sheetH, coverBleedMm, true)` with 8 crop marks and 4 spine fold marks (x = spine edges, outside the bleed); without, MediaBox = BleedBox = TrimBox = the sheet and no marks. Paint order: `backFill` over the bleed box; the front photo (original bytes, EXIF orientation, ICC as the interior) placed by the canvas's `coverPhotoRect`, grown about its anchor to cover the front bleed and clipped to it; back, spine (rotated by direction, cut with "…" past trim height − 2 × safe) and front title texts in the book fonts, empty text drawn as nothing; marks. A missing front photo SHALL be reported in `skipped` and leave the cloth.

#### Scenario: A5 cover boxes

- **WHEN** an A5 book with 20 pages on the generic profile is painted with marks
- **THEN** the TrimBox is 958.11 × 680.31 pt at (22.68, 22.68), the BleedBox 975.12 × 697.32 pt, the MediaBox 1003.46 × 725.67 pt; with marks off all three are 958.11 × 680.31 pt at 0
