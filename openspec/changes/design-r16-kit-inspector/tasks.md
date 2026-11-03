## Implementation

- [x] 1. M86: Save-as-template Button svg 14 × 14 (`context-inspector.tsx`). Kit qa `design-r16 M86`: icon 14,14, label x 1247.06.
- [x] 2. M87: All / My templates tabs = one span with a single space before the count (`context-inspector.tsx`). Kit qa `design-r16 M87`: x 1308.69.
- [x] 3. M88: prod line-heights on the Layout chips, film chips, Add folder… chip and the empty-strip nesting (`context-inspector.tsx`, `chrome.tsx`, `demo-parts/editor.tsx`). Kit qa `design-r16 M88` ×4.
- [x] 4. Kit qa asserts the M86–M88 numbers on `#/demo` at 1440 × 900 (`uikit/scripts/qa.mjs`): 326 PASS / 0 FAIL.

## Manual test scenarios

1. `uikit#/demo` 1440 × 900, new blank book: empty-strip copy y 829.3; Layout chips' text 4.5 below the pill top.
2. Add folder: Unplaced / Added order / Add folder… text 6.0 / 6.5 / 6.5 below the chip top; toggle Unplaced on, unchanged.
3. Layout section: Save as template icon 14 × 14, label x 1247.06; "My templates" x 1308.56; switch to My templates, x unchanged.

- harness problem: `pnpm agent manual-qa` drives prod only (waits for `editor-shell`); this change is kit-only, so evidence is kit qa plus a demo-capture DOM walk (file:// kit build, 1440 × 900).
- OK 1: `editor-new-blank-book` — empty copy y 829.3 (was 827.58); Layout chip "Any" text 182.5 at pill top 178 (4.5; was 3.59).
- OK 2: `editor-photos-added` — chips top 774: Unplaced 780.0, Added order 780.5, Add folder… 780.5 (were 779.59); kit qa: Unplaced on keeps 6.0.
- OK 3: Save as template svg 14, label x 1247.06 (was 24 / 1252.06); My templates x 1308.69 (was 1305.41), unchanged with My templates selected (kit qa).
