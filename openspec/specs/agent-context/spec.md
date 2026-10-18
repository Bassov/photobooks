# agent-context Specification

## Purpose

Defines how Photobooks keeps agent navigation, OpenSpec per-change mandates, distilled skills, and CI security gates coherent so agents do not rediscover the project on every change.

## Requirements

### Requirement: OpenSpec config is the per-change mandate source

The project SHALL keep all per-change agent mandates (proposal/design/tasks verification, apply gates, archive behavior) in `openspec/config.yaml` so propose, apply, and archive workflows receive them via OpenSpec instructions.

#### Scenario: Mandates load from config

- **WHEN** an agent runs OpenSpec instructions for proposal, design, tasks, apply, or archive
- **THEN** the returned rules or operation guidance include the project's current per-change mandates from `openspec/config.yaml`

#### Scenario: No checklist duplication in navigation docs

- **WHEN** an agent reads root `AGENTS.md` or always-applied Cursor workflow rules
- **THEN** those documents MUST NOT contain a duplicate verification checklist or numbered OpenSpec pipeline that conflicts with `openspec/config.yaml`

### Requirement: Archive always syncs delta specs

When a change has delta specs, archive SHALL sync those deltas into main `openspec/specs/` and verify the merge before moving the change. Archive MUST NOT skip-sync while delta specs exist. After the move, archive SHALL close the matching roadmap item on the same branch with `pnpm roadmap done <slug>` when the change maps to one, and SHALL close a related `[contingency]` that is not needed with its gate owner via `pnpm roadmap done <slug> --note "not needed (gate passed in <gate-item>)"`.

#### Scenario: Delta specs require sync before archive

- **WHEN** a completed change has one or more delta spec files and archive is requested
- **THEN** the agent syncs deltas to main specs, verifies the merge, and only then archives the change

#### Scenario: Sync blocked stops archive

- **WHEN** delta sync is blocked or verification fails
- **THEN** archive MUST NOT move the change directory

#### Scenario: No delta specs

- **WHEN** a change has no delta specs
- **THEN** archive MAY proceed and MUST record that no delta specs were synced

#### Scenario: Roadmap item closed after archive move

- **WHEN** a completed change that maps to a roadmap item is archived
- **THEN** `pnpm roadmap done <slug>` ticks its index line on the same branch after the archive move, and when it was the milestone's last item the milestone folder moves to `docs/roadmap/archive/<M>/` in the same commit

#### Scenario: Contingency closed with gate owner

- **WHEN** a gate-owning change archives with its gate green and a related `[contingency]` is not needed
- **THEN** that contingency is closed together with the gate-owning item, with a `--note` recorded in its item file

#### Scenario: Drift grep before archive move

- **WHEN** archive is about to move the change
- **THEN** the agent greps README, AGENTS, `.cursor/rules`, and `docs/` for terms the change touched and fixes drift or notes "No doc changes" next to the Docs/rules sync bullets

### Requirement: Agent navigation map

The repository SHALL provide a root `AGENTS.md` that maps source capabilities to specs and lists verify/security commands as reference only, without per-change workflow mandates. `AGENTS.md` SHALL stay at or under 150 lines.

#### Scenario: Module map present

- **WHEN** an agent opens `AGENTS.md`
- **THEN** it can locate capability directories under `src/` and their corresponding `openspec/specs/` paths

### Requirement: Distilled React and UI skills

The project SHALL provide thin on-demand skills under `.cursor/skills/` for SPA composition, SPA performance, and UI review, without vendoring full third-party skill packs.

#### Scenario: Skills discoverable

- **WHEN** an agent needs React composition, SPA performance, or UI review guidance
- **THEN** project skills `react-composition`, `react-perf-spa`, and `ui-review` are available under `.cursor/skills/`

### Requirement: Design review gate

After `design.md` is written, the parent agent SHALL launch `openspec-design-reviewer` and obtain `pass` before finalizing tasks for apply.

#### Scenario: Design reviewer required

- **WHEN** design.md for a change is completed
- **THEN** `openspec-design-reviewer` MUST return pass before apply proceeds on that design

### Requirement: Deterministic security gates in CI

CI SHALL run dependency audit suitable for blocking high severity issues and CodeQL analysis for JavaScript/TypeScript on pull requests and the default branch.

#### Scenario: Audit in checks

- **WHEN** the checks workflow runs
- **THEN** it executes the project's `pnpm audit:ci` script

#### Scenario: CodeQL on PR

- **WHEN** a pull request targets the default branch
- **THEN** CodeQL analysis for JavaScript/TypeScript runs

### Requirement: Conditional Security Review for high-risk changes

When a change touches the security surface (File System Access, workers/postMessage, blob URLs, CSP/headers, dependency bumps, or export), apply/archive guidance SHALL require a Cursor Security Review subagent pass before archive.

#### Scenario: High-risk archive gate

- **WHEN** a change is security-tagged or modifies the security surface listed above
- **THEN** archive MUST NOT complete until Security Review has returned without open critical/high findings

#### Scenario: Low-risk skip

- **WHEN** a change does not touch that security surface
- **THEN** Security Review is not required

### Requirement: Lessons journal for agents

The repository SHALL provide conflict-free lessons under `docs/lessons/` (per-entry files, with optional index). Per-change mandates in `openspec/config.yaml` SHALL require agents to read lessons before apply and to add a per-entry lesson file when a review finding repeats. `AGENTS.md` SHALL link to the lessons location for navigation only (no duplicated checklist).

#### Scenario: Lessons file present

- **WHEN** an agent opens the lessons location (`docs/lessons/` and optional index)
- **THEN** short durable rules derived from past mistakes are available as per-entry files

#### Scenario: Mandates reference lessons

- **WHEN** an agent loads OpenSpec apply guidance from `openspec/config.yaml`
- **THEN** the guidance requires reading lessons before apply and adding a per-entry lesson file when a review finding repeats

#### Scenario: AGENTS links lessons without checklist duplication

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to the lessons location and MUST NOT find a duplicated verification checklist for lessons updates

### Requirement: Exploratory findings lock into Playwright e2e

When an exploratory browser or MCP session reveals a product bug that is fixed in a change, that change SHALL include a Playwright test under `e2e/` that would have failed before the fix. OpenSpec quality-bar or apply guidance SHALL state this rule.

#### Scenario: MCP or exploratory bug becomes e2e

- **WHEN** a change fixes a bug found via exploratory or MCP browser interaction
- **THEN** the change includes a Playwright test under `e2e/` covering that failure mode before apply is treated as complete

#### Scenario: Mandate is loadable

- **WHEN** an agent loads OpenSpec instructions that include the project quality bar or apply guidance
- **THEN** the returned text includes the exploratory/MCP → Playwright e2e lock-in rule

### Requirement: Future architecture notes

The repository SHALL provide `docs/future-architecture.md` describing the target product architecture for the photobook editor, including product shape, shared geometry/painters, the 60 fps performance model, storage boundaries, image pipeline, print, static site, publishing decisions, rejected or deferred alternatives, and deferred visual-regression e2e with a link to the tracking GitHub issue when one exists. The doc SHALL state that pieces land only through OpenSpec changes listed in `docs/roadmap.md`, not via drive-by implementation. `AGENTS.md` SHALL link to this doc for navigation.

#### Scenario: Future-architecture doc present

- **WHEN** an agent opens `docs/future-architecture.md`
- **THEN** it can find target architecture guidance (including the 60 fps performance model and deferred visual-regression notes) and a pointer that implementation follows `docs/roadmap.md`

#### Scenario: AGENTS links future architecture

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/future-architecture.md`

### Requirement: Product roadmap

The repository SHALL provide the execution plan as an index `docs/roadmap.md` (milestone blocks with goal lines, one single-line entry per item in priority order, `## Deferred (not scheduled)` and `## Archive` sections) plus one file per item under `docs/roadmap/<milestone>/<slug>.md`, finished milestones under `docs/roadmap/archive/<milestone>/`, and a process doc `docs/roadmap/RULES.md` that states 60 fps is part of done for feature work. Item openness SHALL be determined from item-file done status (with migration from historical index ticks). The index and item files SHALL change only through `scripts/roadmap.mjs` (`pnpm roadmap`), and `pnpm roadmap check` SHALL pass in `pnpm test` (warning, not failure, for a fully done but still-active milestone awaiting `roadmap archive`). `AGENTS.md` SHALL link to the roadmap and the `roadmap` skill. `openspec/config.yaml` context Doc budget SHALL mention the roadmap alongside other durable docs.

#### Scenario: Roadmap index present

- **WHEN** an agent runs `pnpm roadmap next`
- **THEN** it prints the first open non-contingency item with its milestone goal, title, file path and full scope, without the agent reading `docs/roadmap.md`

#### Scenario: Layout is validated

- **WHEN** `pnpm test` runs
- **THEN** `scripts/roadmap.test.mjs` runs `check` on the repository roadmap and fails on a missing or orphan item file, a duplicate slug, a multi-line index entry, an incomplete archive, or an index line whose tag or title differs from its item file; a fully done but still-active milestone is reported as a warning, not a hard failure

#### Scenario: AGENTS links roadmap

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/roadmap.md`, the `pnpm roadmap` command and the `roadmap` skill

#### Scenario: Config context mentions roadmap

- **WHEN** an agent loads project context from `openspec/config.yaml`
- **THEN** the Doc budget text mentions `docs/roadmap.md` and `pnpm roadmap`

### Requirement: Scrollport success criteria and Playwright lock-in

When an OpenSpec change introduces or changes an in-app scrollport (`overflow: auto` or `scroll` region), proposal success criteria SHALL state that the document MUST NOT gain page-level horizontal or vertical scroll, and that scrolling MUST occur only inside the named scrollport(s). Apply guidance and the quality bar SHALL require Playwright assertions that the document element fits the viewport (and that the named scrollport overflows when content is longer than the viewport), using shared e2e helpers — not `ui-review` as a gate, and not element `scrollLeft` alone as proof of page containment.

#### Scenario: Proposal names scrollport containment

- **WHEN** a proposal's scope includes introducing or changing an in-app scrollport
- **THEN** its success criteria MUST include no page-level H/V scroll and scrolling only inside the named scrollport(s)

#### Scenario: Playwright page-fit helpers are mandated

- **WHEN** such a change is applied
- **THEN** the change MUST include Playwright coverage that asserts `document.documentElement` scroll size does not exceed client size, via shared helpers under `e2e/`, before apply is treated as complete

#### Scenario: Page overflow is not a ui-review gate

- **WHEN** an agent loads OpenSpec quality-bar or apply guidance from `openspec/config.yaml`
- **THEN** the returned text states that page overflow containment is a Playwright invariant and MUST NOT treat skill `ui-review` as the sole gate for that page-overflow invariant

### Requirement: UI browser smoke before push

When an OpenSpec change includes UI in scope, apply SHALL NOT be treated as complete (and SHALL NOT push/archive) until evidenced browser smoke covers empty state, happy path of the change, and primary scroll/interact, and skill `ui-review` (including layout smoke) has been applied. Observable UX claims in success criteria (packing, aspect silhouette, empty copy readability, viewport fill, object-fit, etc.) MUST have matching Playwright assertions before apply completes. Virtualized or variable-size lists MUST assert mounted-window coverage of the scrollport mid-scroll when more items remain — fixed item counts or LoAF alone are insufficient. Green typecheck/unit verify alone is not apply-complete for UI scope.

#### Scenario: Verification checklist names UI smoke

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a UI-in-scope browser smoke item (empty + happy + primary scroll/interact; skill `ui-review`)

#### Scenario: Apply guidance blocks push without smoke

- **WHEN** an agent loads apply guidance from `openspec/config.yaml`
- **THEN** the guidance MUST require evidenced UI browser smoke and `ui-review` before push/archive when UI is in scope

#### Scenario: Implementation reviewer fails missing UI smoke

- **WHEN** `openspec-implementation-reviewer` reviews a UI-scoped change lacking empty/happy/scroll e2e or layout smoke evidence
- **THEN** the verdict MUST NOT be `pass` (missing coverage is high / revise)

### Requirement: Unattended roadmap item flow

The project SHALL provide `/next-roadmap-item` (optional `<slug>` argument) to run one open roadmap item end to end without editing CLI-generated `opsx-*` or `openspec-*` files. When `<slug>` is given, preflight SHALL use that slug; without it, behaviour matches bare `roadmap next` with the claimed set. Mandates stay in `openspec/config.yaml` and `.cursor/rules/git-finish.mdc`. Security-tagged or security-surface items continue and MUST pass Security Review before archive. Until ratchet or dependency-policy items merge, gate-config and dependency rules in the command scenarios apply. Preflight, finish, and reviewer briefing SHALL use `pnpm agent` composite commands instead of multi-call shell recipes for the same work.

#### Scenario: Command exists and points at SoT

- **WHEN** an agent opens `.cursor/commands/next-roadmap-item.md`
- **THEN** the command describes the end-to-end stages and references `openspec/config.yaml`, `git-finish.mdc` and skill `roadmap` as mandate sources without restating their full checklists

#### Scenario: Command uses composite agent CLI

- **WHEN** an agent follows `.cursor/commands/next-roadmap-item.md`
- **THEN** preflight and finish (and reviewer briefing) are expressed as `pnpm agent` invocations rather than expanded multi-call shell recipes for the same work

#### Scenario: Optional slug argument

- **WHEN** an agent runs `/next-roadmap-item <slug>`
- **THEN** preflight is invoked with `--slug <slug>`

#### Scenario: Security-tagged item continues to Security Review

- **WHEN** the selected roadmap item is tagged `(Security Review: …)` or touches the security surface
- **THEN** the unattended flow MUST continue (it MUST NOT stop solely for that reason) and MUST complete Security Review before archive

#### Scenario: Gate-config edit before ratchet lands

- **WHEN** the selected item edits a quality-gate config and `gate-ratchet`/`gate-ratchet-ci` are not yet merged
- **THEN** the edit MUST be strictly stricter and listed in the touch-set with a reason, or the run MUST stop

#### Scenario: New dependency before dependency-policy lands

- **WHEN** the change adds or changes a dependency and `dependency-policy` is not yet merged
- **THEN** apply MUST include `pnpm audit:ci` evidence and a Security Review pass before archive

#### Scenario: Item selection skips blocked work

- **WHEN** the command picks the next roadmap item without an explicit slug
- **THEN** it runs preflight/`roadmap next` with a claimed set that skips open-PR, remote, local, and worktree-held `feat|fix/*` slugs and `[contingency]` items; milestone archive is a separate post-merge step, not a side effect of `done`

#### Scenario: Defined stop conditions only

- **WHEN** the unattended run encounters a dirty working tree, a milestone review cut, intent that conflicts with a spec or open issue, or three red CI fix rounds
- **THEN** the run MUST stop and ask; a conflict with `main` MUST be auto-merged when trivial and MUST stop only for semantic conflicts; otherwise the run MUST continue through archive and PR (CI wait policy follows the invoking command)

### Requirement: Manual check before archive

After implementation review passes and before archive, changes SHALL run a Manual check and record numbered steps and observed results under `## Manual test scenarios` in `tasks.md`. That section SHALL be the source for the PR section of the same name.

#### Scenario: Verification checklist names Manual check

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a Manual check item that runs after implementation review pass and before archive

#### Scenario: Archive blocked without Manual check

- **WHEN** archive is requested while the Manual check checklist item is unchecked
- **THEN** archive MUST NOT proceed

#### Scenario: Manual check drives Browser check or records N/A

- **WHEN** Manual check runs for a roadmap `[feature]` or UI-scoped change
- **THEN** the agent drives the app through the item's Browser check (or spec scenarios for `[prep]`) and records results; non-UI changes MAY record N/A

#### Scenario: Bug found in Manual check

- **WHEN** Manual check finds a product bug
- **THEN** the change MUST add a Playwright test, fix the bug, and re-run implementation review on the delta before archive

### Requirement: Docs/rules sync

When a change alters behavior, commands, CI output, the module map, or the roadmap item, apply SHALL keep README, AGENTS (≤150 lines, no checklists), affected rules/skills, future-architecture notes, and roadmap annotations aligned with what shipped. Agents MUST NOT add an alwaysApply rule without merging or removing another.

#### Scenario: Verification checklist names Docs/rules sync

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a Docs/rules sync item naming those update targets

#### Scenario: Archive blocked without Docs/rules sync

- **WHEN** archive is requested while the Docs/rules sync checklist item is unchecked
- **THEN** archive MUST NOT proceed

#### Scenario: Implementation reviewer fails stale docs

- **WHEN** `openspec-implementation-reviewer` reviews a change whose diff contradicts README, AGENTS, rules, or future-architecture, or overstates the roadmap item
- **THEN** a stale contradicted statement is at least medium, and a roadmap line that overstates what shipped is high

### Requirement: Change sizing budget

Each OpenSpec change SHALL fit one agent apply context: at most one new subsystem and at most 8 implementation tasks in `tasks.md` (excluding Verification). Line-count target/max and subsystem definition live in `docs/roadmap/RULES.md` Change size. `openspec/config.yaml` SHALL carry the subsystem/task limits and `pnpm roadmap add --after` growth rule, pointing to RULES.md for line counts. RULES.md SHALL include deferred review findings as next items.

#### Scenario: Budget is loadable from OpenSpec instructions

- **WHEN** an agent runs `openspec instructions proposal` or `openspec instructions tasks`
- **THEN** the returned rules state the one-subsystem limit, the 8-task limit, and point to `docs/roadmap/RULES.md` for the line-count target/max

#### Scenario: Over-budget change is split before apply

- **WHEN** a proposed change exceeds the budget
- **THEN** the agent narrows its scope and adds the remainder with `pnpm roadmap add <slug> --after <current>` before apply starts

#### Scenario: Roadmap items fit the budget

- **WHEN** an agent reads an open roadmap item (`pnpm roadmap show <slug>`) that has no OpenSpec change yet, in a milestone without a `**Re-plan:**` line
- **THEN** the item names at most one new subsystem, and a `[feature]` that needs both new non-UI infrastructure and a new UI region has that infrastructure in a preceding `[prep]` item

#### Scenario: Risk fallbacks are explicit items

- **WHEN** a roadmap item has a perf or memory gate whose named fallback adds its own scope
- **THEN** the fallback is a separate `[contingency]` item rather than a clause inside the gated item

#### Scenario: Change size docs name growth for deferred findings

- **WHEN** an agent reads `docs/roadmap/RULES.md` Change size
- **THEN** it states that over-budget overflow and deferred review findings are added with `pnpm roadmap add --after`, not as a larger PR or vague follow-up

### Requirement: Agents must not weaken quality gates

Agents SHALL NOT weaken a quality gate for any reason, including stabilizing a test. There SHALL be no `Stryker disable` until `stryker-diff-gate` defines a budget. Agents SHALL fix failures with code, tests, or a new test seam. `openspec/config.yaml` quality bar, `docs/lessons.md`, and a navigation line in `AGENTS.md` SHALL state this rule.

#### Scenario: Quality bar forbids gate weakening

- **WHEN** an agent loads project context or quality-bar text from `openspec/config.yaml`
- **THEN** the returned text forbids widening exclusions, inline ignore/disable, lowering thresholds, removing checks, loosening assertions or tolerances, retries/`skip`/`fixme`/`test.fail`, and deleting tests or helpers, for any reason, and states that no `Stryker disable` is allowed until `stryker-diff-gate` defines a budget

#### Scenario: Loosening an e2e assertion to stabilize a test is gate weakening

- **WHEN** an agent loosens an e2e assertion or tolerance, or replaces a strict containment check with a weaker overlap check, to stabilize a flaky test
- **THEN** that change MUST be treated as forbidden gate weakening; the agent MUST fix with app code or a deterministic wait, or schedule a roadmap item, and MUST NOT land the looser assertion

#### Scenario: Lessons and AGENTS carry the non-weaken rule

- **WHEN** an agent reads `docs/lessons.md` and root `AGENTS.md`
- **THEN** lessons extend the existing tsconfig/ESLint non-weaken rule to coverage/mutation/thresholds/assertions/retries and forbid `Stryker disable` until `stryker-diff-gate` defines a budget, and AGENTS has a single navigation line pointing agents at that mandate without a checklist

#### Scenario: Red CI is not fixed by gate config

- **WHEN** a PR check is red and `git-finish` guidance applies
- **THEN** the agent MUST fix with code and tests only and MUST NOT weaken gate configuration or assertions to turn the check green

### Requirement: Deferred findings grow the roadmap

When a blocking review finding is deferred, or a change is about to exceed the size budget during propose or apply, the agent SHALL add a new roadmap item with `pnpm roadmap add <slug> --after <current>` (same milestone, scope, Done when) and finish the current change within the budget. Vague follow-ups outside the roadmap are forbidden.

#### Scenario: Over-budget apply grows the roadmap

- **WHEN** planning or apply shows the PR will exceed the size budget
- **THEN** the agent adds overflow via `pnpm roadmap add --after <current>` and keeps the current PR within the limit

#### Scenario: Deferred finding becomes next checkbox

- **WHEN** a blocking reviewer finding is deferred rather than fixed in the current change
- **THEN** it becomes a new roadmap item immediately after the current one via `pnpm roadmap add --after`

### Requirement: Blocking reviewer findings are resolved or scheduled

Blocking (critical or high) findings from `openspec-proposal-reviewer`, `openspec-design-reviewer`, `openspec-implementation-reviewer`, the Security Review subagent, and `adversarial-reviewer` when present SHALL be fixed in the change or turned into roadmap items right after the current item. The PR body SHALL record each reviewer verdict and the disposition of each finding.

#### Scenario: Blocking finding blocks archive until fixed or scheduled

- **WHEN** a listed reviewer returns critical or high findings
- **THEN** archive MUST NOT proceed until each finding is fixed or scheduled as a next roadmap checkbox

#### Scenario: PR records reviewer dispositions

- **WHEN** the agent opens or updates the pull request for the change
- **THEN** the PR body records each reviewer verdict and what happened to each finding

### Requirement: Design touch-set lists gate-file edits

When a design's touch-set includes editing a quality-gate config file (coverage thresholds, mutation config/exclusions, ESLint/tsconfig strictness, CI gate workflows, or equivalent), `openspec/config.yaml` design rules SHALL require each such edit to appear in the touch-set with a reason.

#### Scenario: Gate-file edit needs touch-set reason

- **WHEN** a design proposes editing a quality-gate config file
- **THEN** the touch-set lists that file and states why the edit is required

### Requirement: Implementation reviewer severities for gate edits

`openspec-implementation-reviewer` SHALL treat as high a quality-gate config edit that is missing from the touch-set, has no stated reason, or makes any gate less strict (lower thresholds, higher budgets, more retries, new exclusions, removed checks, looser assertions). A listed edit that is strictly stricter is not a finding. Any other config edit outside the design touch-set is high. Excluding from coverage or mutation a production file that the same diff modifies is critical.

#### Scenario: Gate edit outside touch-set is high

- **WHEN** implementation review finds a gate-file or other config edit not listed in the design touch-set
- **THEN** the finding severity MUST be at least high

#### Scenario: Listed stricter gate edit is not blocking

- **WHEN** implementation review finds a quality-gate config edit that is listed in the touch-set with a reason and is strictly stricter
- **THEN** that edit MUST NOT be reported as a blocking finding

#### Scenario: Same-diff exclusion is critical

- **WHEN** the same change both modifies a production file and adds or widens an exclusion that removes that file from coverage or mutation
- **THEN** the finding severity MUST be critical

### Requirement: Unattended flow token hygiene

`/next-roadmap-item` SHALL minimize prompt growth: no re-read of injected prompt files or of the item file after `roadmap next`; rules from `openspec instructions`; `config.yaml` operations at most once; targeted spec/item edits; quiet/trimmed verify-push-CI output; PR body once; issues as plain URLs.

#### Scenario: No re-read of injected context

- **WHEN** an agent runs `/next-roadmap-item` after receiving the command and alwaysApply rules in the prompt
- **THEN** it MUST NOT open those injected files or `AGENTS.md` again solely to rediscover mandates, and MUST NOT open the item file solely to rediscover scope already printed by `roadmap next`

#### Scenario: Rules from instructions, config once

- **WHEN** the agent needs proposal/design/tasks rules or apply/archive operations text
- **THEN** it takes rules from `openspec instructions` JSON and MAY open `openspec/config.yaml` only for `operations`, at most once in the run

#### Scenario: Quiet verify and CI output

- **WHEN** the agent runs local verify, `git push`, or waits on PR checks
- **THEN** it uses quiet verify/e2e scripts or trimmed tails, and for CI wait suppresses the watch stream then reads a compact JSON summary (failed logs tailed)

#### Scenario: PR body and issues stay compact

- **WHEN** the agent opens or updates the pull request
- **THEN** it generates the PR body once and cites related issues as plain URLs only

### Requirement: Out-of-scope failures

A gate failure SHALL be out of scope only when the same test also fails or flakes on unmodified `origin/main`. Otherwise it MUST be treated as in scope for the current PR.

#### Scenario: Failure only with the change is in scope

- **WHEN** a test outside the touch-set fails only with the change applied
- **THEN** it is in scope and the agent MUST fix it in code or tests in the current PR

#### Scenario: Out-of-scope failure is scheduled not patched in-PR

- **WHEN** pre-push or local verify fails on a test that also fails or flakes on unmodified `origin/main`
- **THEN** the agent MUST NOT enlarge the current PR to fix it; it MUST add a roadmap item or bug issue and MUST NOT treat the PR as mergeable while checks are red

#### Scenario: Filing does not waive red CI stop

- **WHEN** an out-of-scope failure is scheduled as a roadmap item or bug issue
- **THEN** filing MUST NOT make a red PR mergeable, and the git-finish stop after three red CI rounds still applies

### Requirement: Local push budget

Local push SHALL stop after at most two failed attempts under pre-push and report in the PR description instead of looping.

#### Scenario: Two failed push attempts then stop

- **WHEN** local `git push` fails twice under pre-push
- **THEN** the agent MUST stop further push loops and record the failure in the PR description (or stop and ask if no PR exists yet)

### Requirement: Post-review code needs re-review

Any code change after `openspec-implementation-reviewer` has passed SHALL re-run that reviewer on the delta before archive.

#### Scenario: Post-review code needs re-review

- **WHEN** the working tree changes after an implementation-reviewer `pass`
- **THEN** archive MUST NOT proceed until implementation review passes again on that delta

### Requirement: Narrow reviewer briefs

Parent agents SHALL brief `openspec-proposal-reviewer`, `openspec-design-reviewer`, and `openspec-implementation-reviewer` with the change slug, change path, the relevant `rules` array for that stage, `git diff --stat`, and the touch-set working-tree diff. Reviewers SHALL prefer that brief over opening `openspec/config.yaml` or the full roadmap item. Reviewers MUST NOT read other sessions' agent transcripts and MUST NOT run unrelated tool-discovery loops.

#### Scenario: Reviewer uses parent brief

- **WHEN** a listed OpenSpec reviewer subagent starts
- **THEN** its inputs are the parent brief (slug, path, rules, stat, touch-set diff) and it does not open full `openspec/config.yaml` solely to rediscover those rules

#### Scenario: No other-session transcripts

- **WHEN** a reviewer needs evidence
- **THEN** it MUST NOT read transcripts under other sessions' agent-transcript directories and MUST NOT run tool discovery unrelated to the change

### Requirement: Pre-push verify:fast; e2e in CI

Lefthook pre-push SHALL run `pnpm verify:fast` only. Full Playwright e2e SHALL remain a required CI check on every PR. This split MUST NOT exclude production files from coverage or mutation or otherwise weaken quality gates.

#### Scenario: Pre-push is verify:fast

- **WHEN** an agent pushes a branch with Lefthook installed
- **THEN** the pre-push hook runs `pnpm verify:fast` and does not require local Playwright as part of that hook

#### Scenario: CI still gates e2e

- **WHEN** a pull request is opened or updated
- **THEN** CI still runs Playwright e2e as a required gate for the PR

### Requirement: Agent environment bootstrap

The repository SHALL provide a POSIX-sourcable bootstrap script that puts Node matching `.nvmrc` and pnpm on PATH for non-interactive shells without writing a `.tool-versions` file into the tree. `AGENTS.md` SHALL document it in navigation form (≤150 lines, no checklist).

#### Scenario: Bootstrap without repo tool-versions

- **WHEN** an agent sources the bootstrap script in a clean non-interactive shell that has asdf Node installs matching `.nvmrc`
- **THEN** `pnpm` is on PATH, `node -v` reports the `.nvmrc` major, and no `.tool-versions` file is created under the repository root

#### Scenario: Highest matching Node when several installs exist

- **WHEN** multiple asdf Node installs share the `.nvmrc` major
- **THEN** the bootstrap selects the highest version via `sort -V`, sets `ASDF_NODEJS_VERSION` only when that install exists, and MUST NOT use lexical `ls` order alone

#### Scenario: Warn on Node major mismatch

- **WHEN** after bootstrap `node -v` major does not match `.nvmrc`
- **THEN** the script MUST warn on stderr

### Requirement: Composite agent stage commands

The repository SHALL provide a zero-dependency Node CLI (`pnpm agent`, `scripts/agent.mjs`) that collapses `/next-roadmap-item` shell stages into `preflight`, `finish`, and `review-brief`. The CLI SHALL support `--json` and short success output, and SHALL suppress ANSI/spinners when `CI` is set or `--quiet` is passed. `/next-roadmap-item` SHALL invoke these commands for steps that previously required multi-call shell sequences.

#### Scenario: Preflight one report

- **WHEN** an agent runs `pnpm agent preflight` on a clean tree with agent-env available
- **THEN** the command checks env (node/pnpm), syncs `main`, builds a skip-list from open PRs and remote `feat|fix/*` branches, runs `roadmap next --skip`, creates `feat/<slug>` (or `fix/` for bug tags), and prints one compact report including the item, openspec `{template,rules}` for the next artifact stage when available, and the touch-set path or placeholder

#### Scenario: Finish push PR CI

- **WHEN** an agent runs `pnpm agent finish` after commits exist on the feature branch
- **THEN** the command runs `verify:fast:quiet`, verifies the tree is ready to push (no uncommitted work that would block push), pushes with at most two failed attempts, creates or updates the PR, waits for CI with a silent watch then a compact JSON summary, and on failure prints a one-screen report including a tailed `--log-failed` log

#### Scenario: Finish does not invent commits

- **WHEN** `pnpm agent finish` runs and the working tree is dirty
- **THEN** it exits non-zero with a short error and MUST NOT create a commit message or commit on behalf of the agent

#### Scenario: Finish never commits

- **WHEN** `pnpm agent finish` runs on a clean tree
- **THEN** it MUST NOT run `git commit` (push/PR/CI only)

#### Scenario: Review brief one call

- **WHEN** an agent runs `pnpm agent review-brief` for the current change
- **THEN** the output includes slug, change path, the relevant rules array (or path to obtain them), `git diff --stat`, and the touch-set working-tree diff suitable to paste into a reviewer subagent

#### Scenario: JSON and quiet modes

- **WHEN** the agent passes `--json` or `--quiet` (or `CI` is set)
- **THEN** success output is machine-readable JSON or short non-ANSI text respectively

### Requirement: Unattended flow call batching

`/next-roadmap-item` SHALL batch independent tool work: parallel reads/greps in one step; dependent shell steps chained with `&&` in one call; no check-then-recheck loops. OpenSpec artifact stages SHALL write each artifact in one Write and validate once at the end of the stage, not after every edit.

#### Scenario: Parallel independent reads

- **WHEN** the agent needs several independent file reads or greps
- **THEN** it issues them in one parallel tool step

#### Scenario: One validate per artifact stage

- **WHEN** the agent finishes writing an OpenSpec planning artifact for a stage
- **THEN** it validates once at stage end rather than after each incremental edit

### Requirement: Pipeline MCP surface

`AGENTS.md` SHALL document which MCP servers the unattended pipeline needs (minimal set) and that other project-enabled MCP servers SHOULD be disabled for this repo so their tool schemas are not re-sent on every model call. This requirement does not add MCP dependencies to the repository.

#### Scenario: Minimal MCP documented

- **WHEN** an agent opens `AGENTS.md` Commands / Toolchain sections
- **THEN** it can see which MCP servers the pipeline needs and that unused servers should be disabled for this project

### Requirement: Roadmap slug selection and claim

`pnpm roadmap next` SHALL accept optional `--slug <s>` that returns that item when it exists, is open, and belongs to an active milestone. Unknown or already-done slugs MUST fail with a clear message. Contingency items MUST be refused unless contingency selection is requested. `--skip` SHALL keep working. Optional `pnpm roadmap claim <s>` (or an equivalent claimed-set helper used by preflight) SHALL record that the slug is held for skip purposes.

#### Scenario: Explicit open slug

- **WHEN** an agent runs `pnpm roadmap next --slug <open-active-slug>`
- **THEN** the CLI prints the same item view as bare `next` for that slug

#### Scenario: Unknown or done slug fails

- **WHEN** an agent runs `pnpm roadmap next --slug <unknown-or-done>`
- **THEN** the CLI exits non-zero with a message that names the problem

#### Scenario: Contingency refused by default

- **WHEN** an agent runs `pnpm roadmap next --slug <contingency-slug>` without requesting contingency
- **THEN** the CLI exits non-zero and does not select the item

### Requirement: Parallel worktree agent preflight

`pnpm agent preflight --slug <s>` SHALL work in the main checkout and in a linked worktree. It MUST fetch and create or reuse `feat|fix/<slug>` from `origin/main` without switching or pulling local `main`. The clean-tree check SHALL remain. Without `--slug`, preflight SHALL keep the existing main-checkout sync behaviour.

#### Scenario: Linked worktree with main elsewhere

- **WHEN** `main` is checked out in the primary worktree and an agent runs `pnpm agent preflight --slug <s>` in a linked worktree with a clean tree
- **THEN** the command creates or reuses `feat/<s>` (or `fix/<s>`) based on `origin/main` and reports item `<s>`

#### Scenario: No-slug main checkout unchanged

- **WHEN** an agent runs `pnpm agent preflight` without `--slug` in the main checkout
- **THEN** it still syncs local `main` and picks the next unclaimed open item as before

### Requirement: Claimed set includes local and worktree branches

The skip/claimed set used by bare `roadmap next` and preflight SHALL include open PR head slugs, remote `feat|fix/*` slugs, local `feat|fix/*` branches, and branches checked out in any worktree (`git worktree list`). Bare `next` MUST NOT return an item another session already holds.

#### Scenario: Local worktree branch skips next

- **WHEN** another worktree has a local `feat/<slug>` checked out and no open PR exists for that slug
- **THEN** bare `pnpm roadmap next` (with the claimed set applied) skips that slug

### Requirement: Worktree-safe git-internal paths

Agent and roadmap tooling that stores state under git internals SHALL resolve paths with `git rev-parse --git-dir` or `--git-path`, never by joining the repo root with `.git`. This MUST work when `.git` is a file (linked worktree).

#### Scenario: Push-failure counter in linked worktree

- **WHEN** finish records a push failure from a linked worktree
- **THEN** the counter file is written under the resolved git directory and is readable on the next finish attempt in that worktree

### Requirement: Item-file done state and index sync

Roadmap done state SHALL be recorded in the item file (status metadata). Item PRs MUST NOT tick the shared index checkbox. `pnpm roadmap done` SHALL mark the item file done without editing `docs/roadmap.md` for the tick. `pnpm roadmap sync` (or equivalent) SHALL apply index ticks from item-file done state after merge. `list` / `next` / `check` SHALL treat item-file done as the source of truth for openness. Migration MUST keep previously index-ticked items done.

#### Scenario: Parallel dones do not conflict on index

- **WHEN** two branches each mark a different item done via `roadmap done`
- **THEN** neither branch edits the same `docs/roadmap.md` checkbox line, and the branches merge without an index conflict from those dones

#### Scenario: Check accepts pending index tick

- **WHEN** an item file is done and the index line is still unticked
- **THEN** `pnpm roadmap check` accepts that state (or syncs the tick) and does not fail solely for the pending tick

#### Scenario: Migration keeps existing dones

- **WHEN** migration runs on a tree whose index already has `[x]` items
- **THEN** those items remain done under the item-file source of truth

### Requirement: Separate milestone archive step

Milestone archiving SHALL be a post-merge operator step (`pnpm roadmap archive <M>` when every item is done on `main`), not a side effect of `roadmap done`. While a milestone is fully done but still active, `pnpm roadmap check` SHALL warn and MUST NOT fail solely for that reason.

#### Scenario: Last two items close in parallel

- **WHEN** two parallel PRs each close one of the last two open items of a milestone
- **THEN** `roadmap check` stays green (warn allowed) until `roadmap archive <M>` runs

#### Scenario: Done does not archive

- **WHEN** an agent runs `pnpm roadmap done` on the last open item of a milestone
- **THEN** the milestone folder remains active and archive is not performed

### Requirement: Conflict-free lessons entries

Repeated-finding lessons SHALL be stored as separate files under `docs/lessons/` (or an equivalent conflict-free scheme). Mandates that previously required appending to `docs/lessons.md` SHALL require adding a per-entry file instead. Navigation MAY keep an index pointer.

#### Scenario: Two agents add lessons without conflict

- **WHEN** two parallel branches each add a new lesson entry
- **THEN** they do not both append to the same shared journal line and can merge without a lessons-append conflict

### Requirement: Auto-merge trivial main conflicts on finish

When a feature PR conflicts with `main`, git-finish / `pnpm agent finish` SHALL fetch and merge `origin/main`, resolve trivial conflicts (roadmap index/doc lines, lockfile via install, independent hunks), run `pnpm verify:fast:quiet`, and push. It MUST NOT rebase or force-push. Only semantic conflicts SHALL stop the run for human help.

#### Scenario: Trivial roadmap conflict merges

- **WHEN** finish detects a conflict with `main` that is only adjacent roadmap/doc ticks or a lockfile clash
- **THEN** it merges, resolves, verifies, and pushes without stopping for a human

#### Scenario: Semantic conflict stops

- **WHEN** finish encounters overlapping semantic code conflicts
- **THEN** it stops and reports without force-push or rebase

### Requirement: Per-worktree e2e preview port

Local Playwright preview SHALL honor `E2E_PORT` (default `4173`) in Playwright config and preview/test scripts so parallel worktrees do not reuse another worktree’s server.

#### Scenario: Custom port binds preview

- **WHEN** `E2E_PORT` is set to a free port and e2e preview starts
- **THEN** the preview and Playwright `baseURL` use that port
