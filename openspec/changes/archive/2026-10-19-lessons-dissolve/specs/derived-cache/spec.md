## ADDED Requirements

### Requirement: Encode-after-hash thumb puts are awaited

When the editor publishes a thumb URL and then puts encoded bytes into DerivedCache keyed by `contentHash` (encode-after-hash), that put MUST be registered with the pending-hash tracker (`trackHashJob` / `awaitPendingHashes`) so Save cannot finish before the OPFS write settles.

#### Scenario: Save waits for encode-after-hash put

- **WHEN** a thumb is published and a DerivedCache put is started for that asset’s `contentHash`
- **THEN** `awaitPendingHashes` does not resolve until that put settles
