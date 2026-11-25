## MODIFIED Requirements

### Requirement: SPA client-route serving

Production and preview hosts SHALL serve the SPA so that client-side navigation and full-page refresh on non-root paths do not return a missing-asset failure in place of the application shell. A missing hashed build file under `/assets/` SHALL answer 404, never the application shell.

#### Scenario: Refresh on a client route

- **WHEN** a user loads or refreshes a non-root path that the SPA owns on production or a preview host
- **THEN** the response delivers the application shell suitable for client-side routing instead of a bare missing-asset error

#### Scenario: Missing hashed asset

- **WHEN** a script, worker or stylesheet request asks for an `/assets/` file that the deploy does not contain
- **THEN** the response is 404 and not the application shell

## ADDED Requirements

### Requirement: Stale chunk recovery after a redeploy

When a lazily loaded part of the editor fails to load (a stale chunk after a redeploy), the editor SHALL stay rendered; the app SHALL save pending edits and reload the page at most once per 60 s, and otherwise (no library to save into, failed save, or a reload just happened) show the error with a Reload action.

#### Scenario: Stale Site preview chunk

- **WHEN** the user presses Preview and its chunk cannot be loaded
- **THEN** the editor stays rendered and the page either reloads once after saving, or shows the error with Reload and Back, without a reload loop
