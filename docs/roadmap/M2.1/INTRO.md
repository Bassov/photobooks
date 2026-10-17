# M2.1 — notes

**Order:** `recents-home` (PR #71) is finished before M2.1 under the current rules. M2.1 runs before every other open item: M2.2 (library and metadata), then M2.5 (design foundation). M2.5 starts only when M2.1 is done, or at least its gate items (`agent-rules` … `stryker-diff-gate`) and a11y items (`axe-e2e`, `lhci-key-surfaces`). Items run in file order, and each assumes the items above it are merged. Source issues: #72 (process and gates, sections A–L) and #50 (quality roadmap, items 1–10). The **Done when:** line of each `[prep]` here is its success criteria.

**The roadmap grows in place** (see "Change size"): overflow and deferred review findings become the next checkbox, never a bigger PR.

**Gate rules:** gate configs only get stricter. The ratchet runs from the base branch, and there is no label, override or stop-and-ask. A change that would weaken a gate cannot pass; the only way through is code and tests. A new dependency proceeds when the automated dependency checks pass. `(Security Review: …)` annotations mean the Security Review sub-agent runs before archive, not that the owner is asked.

**Owner one-time setup (not agent items):** branch protection on `main` with the required checks listed in `agent-auto-merge` and "Do not allow bypassing the above settings". `CODECOV_TOKEN` available to `checks` and `integration`. Owner manual testing on the preview is optional.
