# print-dialog Specification

## Purpose

Top-bar Print job pill and the Print dialog: options with the print check, the PDF run in the PDF worker, and the written file in the library's `exports/` folder. Painting and checks live in `src/core/pdf/`; the UI and job store in `src/editor/print/`.

## Requirements

### Requirement: Top bar Print pill

The editor top bar SHALL show an icon-only Print job pill between Export site and Publish, 40 × 32 in every state: rest (Printer, title "Print"), running (Printer over a `--control` fill scaled to the percent, title "Exporting PDF · {p}%"), done (CircleCheck, "PDF ready", for 4 s) and failed (warning, "PDF not exported", until the dialog is opened). It SHALL be disabled while idle when the book has no spreads or the library is locked elsewhere, and clicking it SHALL open the Print dialog in the run's current step. The Export site label SHALL hide below 1424 px.

### Requirement: Print dialog

The Print dialog SHALL show the page size, the printer profile, "Imposition · 1 per sheet", an "Add {b} mm bleed and crop marks" checkbox (default on), the summary `PDF · {pages} pages[ on {sheets} sheets] · bleed {b} mm | · trim size, no marks` and a Check block filled by the PDF worker's `check` request (checking, clean, issues), which never disables Export PDF. Export PDF SHALL paint the book as it is at the click in the PDF worker and write `<library>/exports/{pdfFileName}`; the run SHALL show "Page {i} of {sheets} · {p}%" and can be hidden while editing continues.

#### Scenario: PDF ready

- **WHEN** the export finishes
- **THEN** the dialog shows "{file} · {sheets} pages · {MB} MB", "Saved in {library}/exports." and Open PDF, which opens the written file in a new tab

#### Scenario: Write denied

- **WHEN** the library folder refuses the write
- **THEN** the dialog shows "PDF not exported" with the access text and Try again repeats the same export
