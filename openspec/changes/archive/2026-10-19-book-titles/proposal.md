# Proposal

## Why

**Problem:** Books already store optional `title` (schema v3 / `BookSummary`), but home lists raw ids and the editor chrome has no title. Create never asks for a title; rename does not exist.

**Why now:** M2.2 review cut — `asset-metadata-schema` is on main; this feature delivers create-with-title, rename, and title display.

## What Changes

**Scope in:**

- Create book prompts for a title and persists it on the new document
- Rename from home and from editor chrome; persist via existing save path
- Home book list and editor chrome show display title (`title` or fallback `"Untitled book"`)
- E2e: create → rename → reload/reopen persists; home shows titles not ids
- Perf e2e: rename while filmstrip scrolls — zero LoAF
- Display helper for empty/missing title (no schema invent)

**Scope out:**

- Schema/migration changes; EXIF/metadata extract; gate/CI/Stryker scripts; new dependencies; rich title dialogs beyond simple prompt/inline rename

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `editor-shell`: create-with-title; rename from home and editor; title in home list and editor chrome with `"Untitled book"` fallback

## Impact

**Success criteria:**

- Empty home / happy create-with-title / rename from home + editor observable in Playwright
- Primary interact: rename while filmstrip scrolls; home book list scrollport unchanged (`home-scroll` only; no page-level H/V scroll)
- **Browser check:** create with title, rename, reload and reopen — title persists; home shows titles not ids
- **Perf:** title edits are local string updates; rename-while-filmstrip-scroll e2e — zero LoAF
- `pnpm check` green; no new deps

**Risks:**

- **Security:** Reuse the existing library save/load path only — no new File System Access handles, pickers, or permission prompts; cancelled create allocates nothing; rename must not force unlock or escalate permission
- Prompt/cancel on create must not leave orphan books or dirty state
- Home rename of a non-open book must not disturb the active editor book
- Display fallback must not write `"Untitled book"` into storage
