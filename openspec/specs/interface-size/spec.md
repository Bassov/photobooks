# interface-size Specification

## Purpose

Defines how the whole app scales for large screens (interface size): the stored per-computer choice, the clamp to a minimum app size, and the app viewport units that keep layouts inside the window at any scale.

## Requirements

### Requirement: Interface scale core

The app SHALL scale as a whole by an interface scale s (`#root` zoom), with every app viewport height / width token equal to the viewport unit divided by s. The stored choice lives in `localStorage["photobooks.ui.scale.v1"]` as `"100" | "125" | "150"`; any other value counts as 100. The effective scale SHALL be the largest step of 1 / 1.25 / 1.5 that is ≤ the choice and leaves an app of at least 1280×720 CSS px (`innerWidth / s`, `innerHeight / s`), else 1; it is recomputed on window resize and on a `storage` change and is never written back. Product code under `src/editor`, `src/ui` and `src/render` MUST NOT use raw `vh` / `dvh` / `svh` / `vw` units. At 100 % `#root` zoom is 1 and every layout value is unchanged.

#### Scenario: Large screen at 150 %

- **WHEN** the window is 3840×2160 and the stored choice is `"150"`
- **THEN** `#root` has zoom 1.5 and the welcome, library and editor screens fill the window with no page-level scroll

#### Scenario: Window too small for the choice

- **WHEN** the window is 1920×970 with choice `"150"`, or 1440×900 with choice `"125"`
- **THEN** the effective scale is 1.25, respectively 1, and the stored choice is unchanged
