## ADDED Requirements

### Requirement: Site settings in export and publish

Export site and Publish SHALL build every page from the library's `site` settings (title, else "Photobooks"; author; intro; theme). Publish SHALL add the canonical `url` from Hosting's `publicBaseUrl` without a trailing slash; Export to a folder has no url. Without site settings the output SHALL equal the title-only default.

#### Scenario: Exported home uses the site settings

- **WHEN** a library with `site: { title: 'Alps & Sea', author: 'Ann' }` is exported
- **THEN** the home `<title>` names "Alps & Sea" and its lead reads "Photobooks by Ann."

### Requirement: Site settings are saved to the library

The editor SHALL store site settings edits in `library.json` read-modify-write, one write at a time in call order, with no write when the normalised value is unchanged. A failed write SHALL show "Couldn't save site settings to the library folder" and keep the values for the session.

#### Scenario: Unchanged value writes nothing

- **WHEN** the author is set to `' Ann '` while the stored author is `Ann`
- **THEN** `library.json` is not written
