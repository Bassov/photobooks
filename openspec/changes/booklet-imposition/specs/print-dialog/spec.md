## MODIFIED Requirements

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
