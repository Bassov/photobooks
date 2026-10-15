# Proposal

## Problem

Filmstrip thumbnails are labeled with the sanitized asset id. A file such as `фото отпуск 01.jpg` is stored under a name like `asset-7-_01.jpg`, so the gallery does not show the imported file name.

## Why now

Import already keeps `File.name` on session metadata. The next M1 leftover is to use that name as the thumbnail label before gallery sort and filter work.

## Scope in

- Thumbnail label (visible accessible name) uses the session file name when present, otherwise the asset id.
- Unit coverage for a Cyrillic session file name.
- Playwright coverage for a non-ASCII imported file name in the filmstrip.
- Add the `filmstrip-file-name` roadmap item after `drag-swap-unplace` and tick it when this change archives.

## Scope out

- Changing how asset ids are minted or sanitized.
- Sorting, filtering, multi-select, filmstrip resize, or desktop drop.
- A new scrollport, visible filename caption beyond the existing thumbnail label, or persistence of file names in the book document.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: each filmstrip thumbnail’s accessible name is the imported file name when session metadata has one, otherwise the asset id

## Success criteria

- Empty: with no photos, the filmstrip shows “Add a folder or photos to build the gallery.” and no thumbnail
- Happy path: importing a file named outside ASCII shows that exact file name as the thumbnail’s accessible name, not the sanitized asset id
- Interact: activating that named thumbnail selects it; the filmstrip stays the horizontal scrollport and the document does not gain page scroll
- Asset ids stay sanitized; missing session file name still labels the thumbnail with the asset id

## Risks

- Accessible names that differ from asset ids must not break drag payloads, selection keys, or placed-badge identity, which stay on the asset id.
- A late session-meta update must refresh the label without rebuilding the gallery id list.
