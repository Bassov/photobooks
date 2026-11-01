## ADDED Requirements

### Requirement: Restore hydrates cached gallery thumbs

On restore with a granted photo root, right after the manifest-first gallery enqueue, the system SHALL read every gallery asset's DerivedCache thumb into the hot thumb cache in the background: at most 8 reads at a time, nearest to the filmstrip window first, yielding between batches, stopping at the byte budget without evicting. Tiles mounted later MUST render the hydrated thumb with no placeholder.

#### Scenario: Reset cancels the pass

- **WHEN** the thumb cache resets or an asset is removed while the pass reads it
- **THEN** the cancelled pass or the removed asset stores no thumb

#### Scenario: Fling after reload shows no placeholder

- **WHEN** a book with at least 400 cached gallery thumbs reloads and the background pass has finished
- **THEN** flinging the filmstrip to the end and back shows no placeholder inside the filmstrip scrollport

#### Scenario: Outward from the window

- **WHEN** the filmstrip window shows gallery items in the middle of the list
- **THEN** the pass reads those items first, then alternates outward right and left

#### Scenario: Byte budget stops the pass

- **WHEN** the next cached thumb would push hot bytes past the byte budget
- **THEN** the pass stops without evicting any hot thumb
