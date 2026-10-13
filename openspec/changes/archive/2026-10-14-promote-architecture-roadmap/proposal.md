# Proposal

## Problem

Target product architecture and the PR-by-PR execution plan live only under gitignored `.local_dev/`. Agents on `main` still see a short deferred note in `docs/future-architecture.md` and have no durable roadmap, so OpenSpec work cannot follow the agreed sequence or 60 fps bar.

## Why now

Architecture and roadmap drafts are ready to promote. Promoting docs (no runtime code) unlocks the next milestone item `frame-budget-gates` and keeps agent context aligned before editor work starts.

## Scope in

- Promote `.local_dev/future-architecture.md` → `docs/future-architecture.md` (full target architecture, including the 60 fps performance model)
- Promote `.local_dev/roadmap.md` → `docs/roadmap.md` (execution plan; one OpenSpec change per top-level checkbox)
- Update `AGENTS.md` and `openspec/config.yaml` context navigation/doc budget for both docs
- Broaden `agent-context` requirements for architecture + roadmap docs

## Scope out

- Any runtime, worker, header, or budget-code changes (`frame-budget-gates` and later roadmap items)
- Changing the current 200 ms LoAF constant/rules (scheduled in `frame-budget-gates`)
- Committing `.local_dev/` or promoting other scratch notes from that folder

## Success criteria

- `docs/future-architecture.md` describes product shape, shared geometry/painters, 60 fps model, storage, image/print/site decisions, and deferred visual-regression (issue #8)
- `docs/roadmap.md` exists with M0–M8 checkboxes; M0 done; first M1 item is `frame-budget-gates`
- `AGENTS.md` links both docs and stays ≤150 lines; config context mentions the roadmap
- `agent-context` spec requires both docs and their AGENTS links

## Risks

- Doc drift if `.local_dev` copies change during apply — re-read sources from disk before copy
- Agents might treat architecture as implementable now — docs must keep the “OpenSpec change per roadmap item” gate clear

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: broaden future-architecture requirements; add roadmap doc + AGENTS navigation

## Impact

Documentation under `docs/`, `AGENTS.md`, `openspec/config.yaml` context string, and `openspec/specs/agent-context/`. No application or CI runtime change.
