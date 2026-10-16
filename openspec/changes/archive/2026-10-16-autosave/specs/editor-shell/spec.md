# Spec Delta

## ADDED Requirements

### Requirement: Debounced autosave for library-backed books

When a library-backed book is dirty from document edits, the system SHALL persist it automatically after a short idle debounce without requiring Ctrl/Cmd+S. Autosave MUST reuse the durable save path (pending hashes, background serialization) and MUST NOT start during an active pointer drag or camera zoom gesture.

#### Scenario: Idle edit persists without manual save

- **WHEN** the user edits a library-backed book and then stays idle long enough for the debounce to fire with no active gesture
- **THEN** library storage holds the updated gallery and layout for that book id without Ctrl/Cmd+S

#### Scenario: Autosave waits for gesture end

- **WHEN** the book is dirty and a drag or zoom gesture is active through the debounce window
- **THEN** autosave does not start until the gesture ends, after which a new debounce may persist the book

#### Scenario: Reload keeps autosaved edits

- **WHEN** the user edits a library-backed book, autosave completes, and the tab reloads with a granted library handle
- **THEN** the restored book matches the autosaved gallery ids and placements

#### Scenario: Autosave failure keeps the in-memory book

- **WHEN** autosave returns a typed failure such as `permission-required` or `locked-elsewhere`
- **THEN** a non-blocking status message is shown and the in-memory book is unchanged

### Requirement: Save indicator in editor chrome

While a library is open, the editor chrome SHALL expose a save indicator for clean (saved/idle), pending debounce, saving, or last-save error. The indicator MUST NOT create page-level horizontal or vertical scroll; filmstrip and pasteboard remain the only named scrollports.

#### Scenario: Indicator after idle edit reaches saved

- **WHEN** the user edits a library-backed book and then idles with no active gesture until autosave finishes successfully
- **THEN** the save indicator shows a pending or saving state during the cycle and reaches a saved/idle state afterward

#### Scenario: Clean library-backed book shows saved

- **WHEN** a library-backed book is open and has no unsaved edits
- **THEN** the save indicator shows a saved or idle state and the shell stays viewport-contained

#### Scenario: Manual save clears dirty

- **WHEN** the user presses Ctrl/Cmd+S or the chrome Save action on a dirty library-backed book and save succeeds
- **THEN** the save indicator reaches a saved/idle state
