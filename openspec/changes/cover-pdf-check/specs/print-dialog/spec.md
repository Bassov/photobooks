## ADDED Requirements

### Requirement: Cover check rules

When the caller asks for the cover check with the 1 per sheet layout, the print preflight SHALL add cover rules after the interior ones: front photo missing / modified / below the profile's min or warn ppi (only the worse) / not sRGB, spine text below the profile's minimum font size or longer than trimH − 2·safe, and an info row for an empty front. Cover rows SHALL have scope `cover` and no page list; booklet layouts and callers that do not ask get none. The cover PDF SHALL be named `{pdfFileName stem}-cover.pdf`.

#### Scenario: Low-resolution front photo

- **WHEN** the front photo prints below the profile's min ppi on a 1 per sheet check
- **THEN** one error row reads "Front cover photo is {ppi} ppi, below {min} ppi" with scope `cover` and no pages
