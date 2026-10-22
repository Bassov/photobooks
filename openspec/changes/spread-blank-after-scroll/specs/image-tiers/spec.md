## ADDED Requirements

### Requirement: Progressive lower-tier while covering loads

While the covering (desired) zoom tier is not yet decoded for display, a filled frame MUST show the best available lower source already on hand — a cached lower tier object URL and/or the filmstrip thumb — and MUST NOT render as an empty placeholder solely because the covering tier is still loading.

#### Scenario: Cached lower tier shows before covering decode

- **WHEN** the desired covering tier is higher than a tier already present in the hot object-URL cache, and no covering display URL is ready yet
- **THEN** the frame shows that lower cached tier (or the filmstrip thumb if no lower tier is cached) instead of a blank placeholder

#### Scenario: Covering tier replaces the provisional source after decode

- **WHEN** the covering tier finishes decode while a lower provisional source is shown
- **THEN** the frame switches to the covering tier without an empty flash between them
