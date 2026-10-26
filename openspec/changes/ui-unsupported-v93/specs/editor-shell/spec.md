## MODIFIED Requirements

### Requirement: Unsupported-browser screen

When `showDirectoryPicker` is not a function, the browsing context is not secure, the page is not a top-level window (`self !== top`), or the UA is mobile (`navigator.userAgentData?.mobile` when available), the system SHALL show a blocking unsupported-browser screen before IndexedDB restore or permission prompts. Detection MUST be feature-based (not UA alone); Chromium `userAgentData.brands` MAY name the browser in copy and choose the Chromium-API-off variant. The screen MUST match kit unsupported copy and CTAs for its variant (`other` / `no-api` / `mobile`): Get Google Chrome and/or other Chromium browser links (noopener), Copy link (share URL), and on `no-api` a Reload control plus turn-on tips — MUST NOT offer “continue anyway”. Overflow scrolls only inside the named `unsupported-scroll` scrollport (no page-level H/V scroll). No welcome, library, or editor UI MUST render behind it. Automated tests MUST continue to use File System Access stubs as Chromium doubles and MUST NOT force a non-FSA product fallback.

#### Scenario: Missing directory picker blocks the app

- **WHEN** `showDirectoryPicker` is absent (and tests have not installed an FSA stub)
- **THEN** only the unsupported-browser screen is shown with kit CTAs (Get Google Chrome visible) and no welcome/library/editor

#### Scenario: Mobile UA shows desktop-required copy

- **WHEN** `navigator.userAgentData.mobile` is true
- **THEN** the unsupported-browser screen uses the mobile variant (desktop required + Copy link) and blocks other surfaces
