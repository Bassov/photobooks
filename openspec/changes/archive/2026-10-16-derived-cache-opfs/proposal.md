# Proposal

## Problem

Zoom tiers and filmstrip thumbnails live only in bounded in-memory object-URL LRUs. After a reload they are rebuilt from scratch, and nothing yet implements the architecture’s disposable `DerivedCache` keyed by `(assetHash, presetId)` on OPFS.

## Why now

Next unchecked roadmap item after `asset-identity`. Content hashes exist as domain fields; `open-save-project` and later export/publish need a persistent, rebuildable preview cache behind a domain interface.

## Scope in

- Domain `DerivedCache` for preview/derivative blobs keyed by `(assetHash, presetId)`; typed results; memory + OPFS adapters; shared contract-test suite
- Wire zoom-tier and thumbnail caches to persist and hydrate through `DerivedCache` when a content hash is available, keeping bounded hot object-URL LRUs for display
- No new user-facing UI

## Scope out

- Open/save library UI, populating `contentHash` on live gallery import (`open-save-project`)
- Site export derivatives / AVIF pipeline
- Changing tier ladder, decode-before-swap, or filmstrip UX
- Quota UI or cross-origin OPFS sharing

## Capabilities

### New Capabilities

- `derived-cache`: disposable preview/derivative cache keyed by `(assetHash, presetId)`, with memory and OPFS adapters and a shared contract suite

### Modified Capabilities

- `image-tiers`: when `contentHash` is present, tier bytes persist and hydrate via `DerivedCache`; hot object-URL LRU stays bounded with revoke on eviction and at most one new tier URL per frame
- `editor-shell`: when `contentHash` is present, thumbnail preview bytes persist and hydrate via `DerivedCache`; bounded hot object-URL LRU and revoke-on-eviction unchanged; no filmstrip UX change

## Success criteria

- Callers persist and load derivative bytes through `DerivedCache` without seeing OPFS paths or handles on the domain API
- Memory and OPFS adapters both pass the shared contract suite (including typed miss / failure codes)
- Keys are `(assetHash, presetId)`; cache is disposable and rebuildable from originals
- OPFS contract proves put → new adapter instance on the same root → get returns the same bytes for that `(assetHash, presetId)`
- When `contentHash` is present, tier pipeline reads/writes `DerivedCache` and still publishes at most one new tier object URL per frame with revoke on eviction
- When `contentHash` is present, thumbnail pipeline reads/writes `DerivedCache` and keeps the existing bounded LRU with revoke on eviction
- **Assumption:** when `contentHash` is absent (current live import), behavior stays memory-only for that asset; no fake hash keys
- No UI; `src/core` stays pure

## Risks

- **Security:** OPFS + blob/object URLs — cache contents must stay origin-private; object URLs still revoked on eviction; domain API must not expose file handles or absolute paths
- Size budget: one subsystem (`DerivedCache` + adapters + thin tier/thumb wiring); reuse existing LRU and contract-suite patterns
- OPFS availability / quota in tests — keep a memory adapter and a harness-friendly OPFS root
