# Proposal

## Problem

Pull requests get three separate sticky comments (Lighthouse, mutation, coverage). They are hard to scan together, and a trial merge of them nested detail blocks and dropped other sections' status.

## Why now

Issue #10 asks for one CI message. The trial PR #25 is not a base: it parses rendered HTML and races on a single comment body.

## Scope in

- One pull-request comment with Lighthouse, mutation, and coverage sections
- Each section shows Waiting, Skipped, Job failed, or Job succeeded with Check passed or Check failed
- A details disclosure only for Job succeeded, containing that check's existing summary markdown
- Removal of the three separate sticky comments, including leftovers on later updates
- Delta to `ci-gates`

## Scope out

- A job that waits for every workflow and then writes the comment
- Nightly full mutation (`stryker-full`) posting to the pull-request comment
- Codecov and Cloudflare pull-request comments
- An extra rollup table or new in-comment "View" links (existing summary tables and report links stay inside details)
- UI, e2e, or app behavior

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: replace the three sticky pull-request comments with one sectioned CI report comment

## Success criteria

- On a pull request, the Lighthouse workflow updates only the Lighthouse section, the diff-mutation workflow only the mutation section, and the checks workflow only the coverage section of a single CI report comment
- Section state, in order: no write yet means Waiting; the producer step succeeded and intentionally wrote no report file means Skipped and no details; the producer step failed or was skipped and no report file exists means Job failed and no details; a report file exists means Job succeeded, Check passed or Check failed from that step's outcome, and a details block with that check's existing summary markdown
- Repeating an update does not nest details or reset another section's status
- After an update, the previous separate sticky comments for Lighthouse, mutation, and coverage are absent
- A run whose head is no longer the pull-request head does not change the comment, including when that run was cancelled
- Mutation HTML artifact and Actions Step Summaries stay
- `stryker-full` does not post the pull-request comment

## Risks

- Overlapping writers can drop a section unless comment updates are serialized per pull request
- A cancelled run that ignores the head check can publish a stale section for a newer commit
