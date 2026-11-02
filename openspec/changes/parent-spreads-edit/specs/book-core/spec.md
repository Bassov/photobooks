## ADDED Requirements

### Requirement: Parent spread editing

The book SHALL support creating a parent (id unused by any spread or parent, name "Master `<next free letter>`", no items), renaming it (trimmed, non-empty; else unchanged) and deleting it; deleting SHALL set `parentId` to `null` on spreads that stored its id and drop a matching `defaultParentId`, so those spreads resolve to None. Every spread item op addressed to a parent id SHALL edit that parent's items exactly as it edits a spread's, and the parent SHALL resolve and paint as a two-page spread. Each create / rename / delete / item edit MUST be one history step and MUST notify only the parent and the spreads that resolve to it. The editor's Masters mode SHALL list the book's parents (thumb + name, New master, Rename, Delete) and show the selected parent on the canvas, where its items are added, moved and resized like spread items; the Masters list scrolls inside its panel only.

#### Scenario: Delete falls back to None

- **WHEN** parent P is the book default and spread 2 stores `parentId` P
- **THEN** deleting P removes it, `defaultParentId` and spread 2's parent resolve to none, and no spread paints a parent layer

#### Scenario: Move once, every spread updates

- **WHEN** every spread uses parent P and P's logo is moved once in Masters mode
- **THEN** the logo's rect changes in P only, and every spread resolves the logo at the new rect
