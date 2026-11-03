## MODIFIED Requirements

### Requirement: Layout grid editing UI

The spread Inspector SHALL offer a Grid section (summary `columns×rows`, a `Use master` / `Use book` (no parent) or `Custom` switch, a Show grid switch for the editor-only overlay); the book grid has no Inspector section. `Use master` SHALL show a one-line summary and reset every spread override (one step). `Custom` SHALL show the eight fields in the master field look (C R / G RG, Margins + link, T B / I O): a field the spread does not override reads grey 400, an overridden field dark 600 with a ↺ button that removes that field (all four margins while linked) as one 'Reset grid value' step; each field's book / master / spread source MUST be in its `title` and accessible description, and the hint MUST read "Grey values follow <parent>." or "Grey values follow the book grid.". Resetting the last override SHALL keep Custom open until the spread changes. Turning the margin link on SHALL write only the margins that differ from Top. The overlay MUST NOT appear in thumbnails or output.

#### Scenario: Spread override label

- **WHEN** the user sets the Gutter on a spread using Master A and then presses its ↺
- **THEN** the Gutter reads dark 600 with ↺ and the source "set on this spread", then returns to the Master A value in grey while Custom stays selected
