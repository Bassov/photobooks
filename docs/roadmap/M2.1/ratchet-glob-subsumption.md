# ratchet-glob-subsumption

Tag: prep
Milestone: M2.1
Title: pr-policy ratchet understands glob subsumption
Status: done

## Scope

- [x] The pr-policy ratchet treats a removed coverage include / Stryker mutate entry / Codecov flag path as fine when a remaining glob or prefix on the head covers it
- [x] A newly added exclude is fine only if it matches a test file pattern or is a listed thin CLI (the existing ≤10-line one-import-one-call rule from scripts-in-scope); anything else stays a violation
- [x] Tests prove real weakening still fails: a removed path not covered by any remaining glob, a broad exclude (e.g. `!scripts/**`, `!src/**/*.ts`), a non-thin CLI exclude, a Codecov path dropped with no covering prefix
- **Done when:** replaying #126's config change (main before #126 vs #126's head config) through the ratchet yields 0 violations (fixture test from the real files); each of the real-weakening cases in (3) is red (tests); coverage/mutation >=85 on the diff, 0 NoCoverage; no other gate loosened.
- **Size:** ~400
- **Source:** owner decision 2026-10-19, follow-up of PR #126

## Done note

mutate-positive subsumption + #126 replay fixture + Scope(3) FIXTURE_IDS; helpers from #126 reused; stryker:diff 85.40% 0 NoCoverage
