## MODIFIED Requirements

### Requirement: Unsupported-browser screen

When `showDirectoryPicker` is not a function, the browsing context is not secure, the page is not a top-level window (`self !== top`), or the device is mobile (`navigator.userAgentData.mobile`, a UA with `iPhone|iPad|iPod|Android`, or a `Macintosh` UA with `maxTouchPoints > 1`), the system SHALL show a blocking unsupported-browser screen before IndexedDB restore or permission prompts. Desktop detection MUST stay feature-based; Chromium `userAgentData.brands` MAY name the browser and choose the Chromium-API-off variant, else the UA MAY name Firefox or Safari. The screen MUST match the kit unsupported page for its variant (`other` / `no-api` / `mobile`): Get Google Chrome and/or other Chromium browser pills (noopener, no bullets, no underline), Copy link (share URL), and on `no-api` a Reload control plus turn-on tips — MUST NOT offer “continue anyway”; it MUST NOT depend on Tailwind preflight. Overflow scrolls only inside `unsupported-scroll` (no page-level H/V scroll, also at 320 px). No welcome, library, or editor UI MUST render behind it. Tests MUST keep File System Access stubs as Chromium doubles.

#### Scenario: Missing directory picker blocks the app

- **WHEN** `showDirectoryPicker` is absent (and tests have not installed an FSA stub), e.g. Safari on a Mac or desktop Firefox without UA brands
- **THEN** only the unsupported-browser screen is shown with kit CTAs (Get Google Chrome visible), naming “Safari” / “Firefox” from the UA, and no welcome/library/editor

#### Scenario: Mobile device shows desktop-required copy

- **WHEN** `navigator.userAgentData.mobile` is true, or the UA is iPhone / iPad (incl. Macintosh + touch) / Android
- **THEN** the unsupported-browser screen uses the mobile variant (desktop required + Copy link) and blocks other surfaces
