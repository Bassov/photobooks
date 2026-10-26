## Implementation

- [x] 1. Align type application: `font-synthesis-weight: none`; library heading/cover weight 500 + italic Lora on covers
- [x] 2. Optional `BookSummary.editedAtMs` via FSA/memory list; delta `library-storage`; relative meta formatter
- [x] 3. BookTile meta `N pages · edited …`; Last-edited sort by `editedAtMs`; keep book-shaped BookObject chrome
- [x] 4. LibraryBar/LibraryScreen layout so Create (black) + Search + Sort + gear stay visible at ≥1280×800
- [x] 5. Unit + e2e lock-ins (chrome visibility, book-object, edited meta, library scrollport); ui-review

## Manual test scenarios

1. Library with ≥1 book at 1280×800: Create (black), Search, Sort, settings gear all visible and usable
2. Covers book-shaped with Lora italic title; meta shows edited when data available
3. Search/Sort work; grid scrolls only in `library-scroll`; tone-only chrome (no blue / hard nos)
