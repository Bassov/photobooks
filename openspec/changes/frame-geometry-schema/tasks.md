## Implementation

- [x] 1. Schema v4: frame `rotationDeg` / `locked?`, crop `quarterTurns` / `straightenDeg?` (`src/core/parse.test.ts`)
- [x] 2. `migrateV3ToV4` + reject-newer (`src/core/migrate.test.ts`)
- [x] 3. Resolver: `ResolvedItem.rotation` from `rotationDeg`; quarter-turn aware `sourceCropRect`; PBT (`src/core/geometry/geometry.test.ts`)
- [x] 4. Roadmap item SoT fields filled

## Manual test scenarios

N/A (no UI)
