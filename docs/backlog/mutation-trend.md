# mutation-trend

Tag: prep
Milestone: M2.1
Title: nightly mutation trend per file (#50 item 6)

## Scope

- [ ] `stryker-full` publishes per-directory and per-file scores with the delta against the previous nightly (artifact `mutation-trend.json` + job summary), and lists files below the diff threshold (85)
- [ ] The previous run is read from the last successful nightly artifact; no external dashboard
- **Done when:** the job summary of two consecutive nightlies shows per-file deltas and the under-threshold list.
- **Size:** ~250 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #50 item 6
