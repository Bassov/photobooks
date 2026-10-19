## ADDED Requirements

### Requirement: Workers Builds pin Node via nvmrc

Cloudflare Workers Builds SHALL pin the Node major via `.nvmrc` (or `.node-version` / `NODE_VERSION`). Builds MUST NOT rely on asdf or a committed `.tool-versions` pin for Node on that image. A transient `wrangler preview` 504 is treated as infrastructure flake (retry), not an application defect.

#### Scenario: nvmrc is the Workers Builds pin

- **WHEN** an agent or operator configures Node for Cloudflare Workers Builds
- **THEN** the pin is expressed with `.nvmrc` (major 22 is enough) and not via asdf / `.tool-versions`
