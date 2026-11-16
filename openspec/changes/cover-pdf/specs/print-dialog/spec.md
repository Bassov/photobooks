## ADDED Requirements

### Requirement: Cover file in the Print dialog

The Print dialog SHALL show a read-only Cover row between Printer and Imposition in every layout: with 1 per sheet `{sheetW/10} × {sheetH/10} cm · spine {spine} mm` from the book's cover geometry, with 2-up / 4-up `None with booklets`. With 1 per sheet the summary SHALL read `PDF · {pages} pages + cover · …` (`, cover {c} mm` after the bleed and `(cover {c} mm)` in the checkbox label only when the cover bleed differs), the Check block SHALL list the `cover` scope rows, and Export PDF SHALL write the pages PDF and then `{pdfCoverFileName}` from the PDF worker's `cover` request into the same `exports/` folder, counting the cover as one more unit (`Cover · {p}%`) before `Saving · {p}%`. Booklets SHALL show no cover rows (label and error note count only the shown rows) and write no cover file. A failure of either file SHALL show the failed step; Try again SHALL re-run both.

#### Scenario: Pages and cover ready

- **WHEN** a 1 per sheet export finishes
- **THEN** the dialog shows "{coverFile} · cover · {MB} MB" under the pages line, a skipped front photo is counted with ` · cover` leading the page list, and Open pages / Open cover open the two written files

### Requirement: Cover spine paints the back fill

The editor cover (canvas sheet and mini covers) SHALL paint the spine in the cover's `backFill`, as the cover PDF prints it.
