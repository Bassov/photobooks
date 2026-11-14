## ADDED Requirements

### Requirement: Same-origin Cloudflare API relay

The Worker SHALL serve `/api/cf/*` with a stateless relay to `https://api.cloudflare.com/client/v4`; every other path SHALL stay assets-only. The relay SHALL store, log and echo nothing from a request, and every relay response SHALL carry `Cache-Control: no-store`.

#### Scenario: Cross-origin call

- **WHEN** a request's `Origin` differs from its own origin or `Sec-Fetch-Site` is not `same-origin`
- **THEN** the relay answers 403 and calls nothing upstream

#### Scenario: Unlisted route

- **WHEN** method + path is not on the allowlist (`:a` 32 hex, `:b` bucket name, `/zones` query keys `account.id`, `status`, `per_page`, `page` only)
- **THEN** the relay answers 404 and calls nothing upstream

### Requirement: Narrow relay bodies and headers

The relay SHALL accept JSON bodies of at most 16 KB checked against closed schemas, SHALL forward only `Authorization` and `Content-Type`, and SHALL drop all upstream response headers except `Content-Type`.

#### Scenario: Broader token request

- **WHEN** `POST /user/tokens` has more than one policy, a group other than Bucket Item Write, a resource other than one `com.cloudflare.edge.r2.bucket.<a>_default_<b>`, a `condition`, or a name over 120 characters
- **THEN** the relay answers 403 and calls nothing upstream

#### Scenario: Deleting a token

- **WHEN** `DELETE /user/tokens/:id` arrives
- **THEN** the relay forwards it only when its own verify call with the same token returns that id, else 403
