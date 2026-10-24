## MODIFIED Requirements

### Requirement: Derived-cache thumbnails

When durable identity (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`) is complete, thumbnail bytes SHALL persist under the identity digest and a thumbnail preset id, and hydrate from derived cache before re-encode. Without complete identity, caching stays memory-only (hot object-URL LRU) without fabricating keys; layout/virtualization/naming unchanged. In-session thumb bytes MAY republish after LRU eviction before a durable identity digest is available for DerivedCache.

#### Scenario: Identity hydrate; incomplete identity memory-only

- **WHEN** an identity-complete asset’s hot URL is missing and cache holds the preset — or an identity-incomplete asset produces a thumb
- **THEN** identity thumbs hydrate from cache / are stored after encode, and incomplete-identity thumbs do not write derived-cache keys
