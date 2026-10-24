## ADDED Requirements

### Requirement: Visible filmstrip tiles prioritize decode

Decode and thumbnail work for assets in the mounted filmstrip window MUST outrank off-window gallery work. Changing the visible window MUST update the visible-asset set used by the worker queue so newly visible tiles are preferred without aborting an in-flight import batch.

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred by the decode queue over off-window ids
