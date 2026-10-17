# open-save-project

Tag: feature
Milestone: M2
Title: library on disk

## Scope

- [x] Create / open library folder, create book; gallery and layout persist in `book.json`, added folders/files register source roots
- [x] Save (Ctrl/Cmd+S) and restore on reopen
- **Perf:** serialization at background priority (worker if over budget). Gate: save during a drag — zero LoAF.
- **Browser check:** build a book, save, reload the tab, reopen the folder — same book.
- **UI ref:** `uikit#/feature/open-save-project`
