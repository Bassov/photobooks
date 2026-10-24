## Implementation

- [x] 1. OpenSpec deltas: update `photo-card`, `filmstrip`, `editor-shell`, `asset-source`; remove Add-photos / file-input product requirements; add one-folder + durable handle + photo re-grant.
- [x] 2. IDB `source-root-handles` (+ book→root map) with `read` query/request helpers mirroring library session, separate from `library-handles`.
- [x] 3. Folder pick keeps handle; wire remember → FSA AssetSource → scan/import with shared `sourceRootId`; Change folder confirm replaces root.
- [x] 4. Product UI + cleanup: single Choose/Change photo folder…; remove Add photos, hidden file inputs, `pickPhotosWithFilePicker` / `canUseOpenFilePicker` / product `files` source paths; uikit/specimen copy.
- [x] 5. Reload restore + one-click photo-folder Allow access; denied/missing → existing relink UX.
- [x] 6. E2e: directory-picker stubs; stop forcing file-input fallbacks; unit coverage for store + import wiring.

## Manual test scenarios

1. Empty editor: only Choose photo folder…; pick folder → gallery fills; no Add photos control; with enough thumbs, gallery scrolls only in the filmstrip (document has no page scroll).
   - OK — covered by `e2e/editor-empty-hints` + `e2e/filmstrip` folder import / scrollport asserts; ui-review PASS.
2. Reload with granted photo handle: originals resolve without picker; Change photo folder… visible.
   - OK — unit `photoRootSession` restore granted + e2e open-save / filmstrip library re-import hydrate thumbs without re-pick.
3. Reload with prompt permission: Allow access to \<folder\> re-grants in one click; denied/missing shows missing-assets path.
   - OK — unit `photoRootSession` prompt→regrant; missing/denied → existing missing-assets-relink e2e path.
