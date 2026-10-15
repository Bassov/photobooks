# Spec Delta

## ADDED Requirements

### Requirement: Placed frames show the covering tier

After the camera gesture settles, a filled frame SHALL display the covering zoom tier for its on-screen size. An empty frame MUST remain a placeholder and MUST NOT show an image.

#### Scenario: Empty fixture frame stays empty

- **WHEN** the painter fixture is shown
- **THEN** the first frame of the first spread is a placeholder and has no image

#### Scenario: Settled zoom shows the covering tier

- **WHEN** the painter fixture zoom reaches at least 400% of physical size and the gesture has settled
- **THEN** a filled frame shows an image whose tier covers that frame's on-screen size
