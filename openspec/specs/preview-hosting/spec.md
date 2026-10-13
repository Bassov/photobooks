# preview-hosting Specification

## Purpose

Provides HTTPS hosting for the Photobooks static SPA in production and on per-branch/PR previews so reviewers can exercise secure-context browser APIs against a public URL.

## Requirements

### Requirement: Production HTTPS deploy

The system SHALL publish the production Vite build to a stable HTTPS URL after changes land on the configured production branch.

#### Scenario: Production branch deploy succeeds

- **WHEN** a commit is pushed or merged to the production branch and the Cloudflare build succeeds
- **THEN** the production HTTPS URL serves the updated SPA shell

### Requirement: Per-branch preview deploys

The system SHALL publish a preview deployment for non-production branches so each active PR/branch has a reachable HTTPS preview URL without affecting production.

#### Scenario: Preview build for a PR branch

- **WHEN** a non-production branch with an open pull request builds successfully
- **THEN** a HTTPS preview URL for that branch serves the SPA from that build

### Requirement: Preview link on pull request

After a successful preview build for a pull request, Cloudflare SHALL post a pull request comment that includes a reachable preview URL for that build or branch.

#### Scenario: PR comment after successful preview build

- **WHEN** a preview build for an open pull request completes successfully
- **THEN** the pull request shows a Cloudflare comment containing a working HTTPS preview URL

### Requirement: SPA client-route serving

Production and preview hosts SHALL serve the SPA so that client-side navigation and full-page refresh on non-root paths do not return a missing-asset failure in place of the application shell.

#### Scenario: Refresh on a client route

- **WHEN** a user loads or refreshes a non-root path that the SPA owns on production or a preview host
- **THEN** the response delivers the application shell suitable for client-side routing instead of a bare missing-asset error
