## Proposal

Roadmap: `docs/roadmap/P4/pdf-streaming.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- No UI change; print store states, percents and failure codes stay as they are.
- Imposition still loads the whole page PDF (pdf-lib needs it); only its output streams.

### Delta / Risk

- The PDF moves as ordered `chunk` messages (transferred) and a final `done` without bytes; the file is written while painting, so a classic xref table replaces pdf-lib's object streams.
- Security: chunks only cross the PDF worker boundary as transferred `ArrayBuffer`s; the writable is opened in the user-granted library folder only and aborted on failure, so a failed run never replaces a previous PDF.
