# ui-library-empty-v93

Tag: feature
Milestone: M2.6
Title: Port empty library + Create book dialog from kit v0.9.3
Status: done

## Scope

- [x] Port empty-library screen + Create book dialog from kit (shared title + page-size dialog)
- [x] Keep create-book → projectSession / bookStore wiring; example cover + Create book CTA match kit
- [x] Retire old empty-home `pb-screen` placeholder chrome
- **UI kit:** `uikit/src/features/library.tsx` (`LibraryEmpty` / empty `HomeScreen`), `uikit/src/features/create-book.tsx`, `UI ref: uikit#/screen/home` (empty), `UI ref: uikit#/demo`
- **Browser check:** Empty library matches kit; Create book opens the shared dialog; creating a book opens the editor with the new title/size
- **Perf:** Empty library is static chrome; Create book open/close has no LoAF; dialog open handler p95 ≤ 2 ms
- **Size:** ~600–1000 changed lines
- **Source:** Owner package F

## Done note

kit empty library + Create book dialog; PR pending
