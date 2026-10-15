## ADDED Requirements

### Requirement: Consolidated CI report comment

On a pull request, the Lighthouse workflow, the diff-mutation workflow, and the checks workflow SHALL update one shared CI report comment, each workflow only its own section. The comment SHALL NOT add a rollup table or a link whose only target is another section.

#### Scenario: One comment and one section per workflow

- **WHEN** the Lighthouse, diff-mutation, and checks workflows finish on the same pull request
- **THEN** the pull request has one CI report comment, Lighthouse results only in the Lighthouse section, mutation results only in the mutation section, and coverage results only in the coverage section

#### Scenario: Section is waiting

- **WHEN** a workflow has not yet written its section
- **THEN** that section shows Waiting and has no details disclosure

#### Scenario: Section is skipped

- **WHEN** the producer step succeeds and intentionally produces no report file
- **THEN** that section shows Skipped and has no details disclosure

#### Scenario: Section job failed

- **WHEN** the producer step fails or is skipped and no report file exists
- **THEN** that section shows Job failed and has no details disclosure

#### Scenario: Section job succeeded

- **WHEN** a report file exists for that section
- **THEN** the section shows Job succeeded, Check passed or Check failed matching the producer step outcome, and one details disclosure whose body is that check's existing summary markdown

#### Scenario: Repeat update keeps other sections

- **WHEN** one workflow updates its section again
- **THEN** the other sections keep their status and details disclosures are not nested

#### Scenario: Superseded head does not write

- **WHEN** a workflow run's commit is no longer the pull request head, including when that run was cancelled
- **THEN** the CI report comment is unchanged

#### Scenario: Legacy sticky comments are removed

- **WHEN** the CI report comment is created or updated
- **THEN** the separate Lighthouse, mutation, and coverage sticky comments are absent

### Requirement: Nightly mutation stays off the CI report comment

The scheduled full mutation workflow SHALL NOT create or update the pull-request CI report comment.

#### Scenario: Nightly full mutation

- **WHEN** the scheduled full mutation workflow finishes
- **THEN** the pull-request CI report comment is unchanged

## MODIFIED Requirements

### Requirement: Lighthouse reporting on pull requests

The Lighthouse CI job on a pull request SHALL publish category scores and a link to the HTML report in the Lighthouse section of the CI report comment when LHCI output is available.

#### Scenario: Lighthouse sticky comment

- **WHEN** the Lighthouse workflow finishes on a pull request and LHCI output is available
- **THEN** the Lighthouse section's details include category scores and report link(s)

### Requirement: Mutation reporting on pull requests

The pull-request mutation job SHALL publish a PR-visible mutation summary in the mutation section of the CI report comment and a downloadable HTML mutation report, and SHALL write a job Step Summary with the mutation score.

#### Scenario: Mutation sticky comment and artifact

- **WHEN** the pull-request mutation workflow completes and a mutation report was produced
- **THEN** it uploads the HTML mutation report as an artifact and the mutation section's details include the mutation score summary

#### Scenario: Mutation Step Summary

- **WHEN** the pull-request mutation workflow produces a mutation report
- **THEN** the job Step Summary includes the mutation score and killed/survived counts

#### Scenario: Empty mutate set

- **WHEN** the pull-request mutation workflow succeeds without a mutation report file
- **THEN** the mutation section shows Skipped and has no details disclosure

### Requirement: Coverage Step Summary

The checks workflow SHALL write a compact coverage summary to the job Step Summary after coverage runs, and on pull requests SHALL record the same totals in the coverage section of the CI report comment when a coverage summary file is available.

#### Scenario: Coverage visible in Actions Summary

- **WHEN** the checks workflow finishes the coverage step
- **THEN** the job Step Summary includes coverage totals

#### Scenario: Coverage sticky comment on pull request

- **WHEN** the checks workflow produces coverage summary JSON on a pull request
- **THEN** the coverage section's details include coverage totals

#### Scenario: Coverage missing because the job failed

- **WHEN** the checks workflow finishes on a pull request without coverage summary JSON because an earlier step failed or the coverage step was skipped
- **THEN** the coverage section shows Job failed and has no details disclosure
