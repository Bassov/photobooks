## MODIFIED Requirements

### Requirement: Frame context menu, arrange shortcuts and lock

Right-clicking an editor frame (or Shift+F10 on a focused one) SHALL select it and open a menu with Bring to front, Bring forward, Send backward, Send to back and Lock / Unlock, dispatching the same ops as the inspector Arrange buttons and lock toggle; a move that cannot change the order is hidden, never disabled. The inspector Arrange buttons (single and multi selection) SHALL be named with their shortcut, kit `inspector.tsx`: "Send to back (Shift+Ctrl+[)", "Send backward (Ctrl+[)", "Bring forward (Ctrl+])", "Bring to front (Shift+Ctrl+])"; the menu shows the same shortcut text. Ctrl/Cmd+] / Ctrl/Cmd+[ SHALL bring the selected frame forward / send it backward, with Shift to the front / back, and Ctrl/Cmd+Shift+L SHALL toggle its lock. A locked frame SHALL NOT move, resize, start a photo drag, accept a dropped photo or take part in a click swap as source or target (the status shows the frame-locked message, the selection and both frames stay unchanged, no undo step); unlocking restores all of these. With 2 or more frames selected, right-clicking one of them SHALL keep the selection; the menu, the arrange shortcuts and Lock SHALL act on the whole set (one `reorderFrames` / `setFramesLocked` undo step; Lock locks all when any is unlocked, else unlocks all) and the menu SHALL add "Delete N frames". On a local override copy the frame menu SHALL read Reset to parent ("Reset to parent"), Hide on this spread ("Hide parent item"), a separator and Lock, with no z-order rows. A right-click on a book spread that misses every own frame and copy SHALL hit test like the override press (a shown parent guide within 4.5 screen px first, else the topmost parent frame, through own frames) and open the Parent item menu: Override on this spread (shortcut text "Ctrl+Shift+Click", "⌘⇧Click" on Mac; a frame copy is selected) and Hide on this spread; a miss opens no menu.

#### Scenario: Send behind from the menu

- **WHEN** the user right-clicks the top of two overlapping frames and picks Send to back
- **THEN** the other frame is on top at the overlap and the inspector shows layer 1 for the clicked frame

#### Scenario: Locked frame ignores drag and drop

- **WHEN** a frame is locked and the user drags it or drops a filmstrip photo onto it
- **THEN** its box is unchanged, it shows no resize handles and it stays empty; after Ctrl/Cmd+Shift+L a drag moves it

#### Scenario: Click swap with a locked frame

- **WHEN** a locked filled frame is selected and the user clicks another filled frame (or the other way round)
- **THEN** both photos stay, both frames keep their lock flags, the status shows the frame-locked message and Undo has no new step

#### Scenario: Override and hide from the menu

- **WHEN** the user right-clicks the Master A logo, picks Override on this spread, then right-clicks the copy and picks Hide on this spread
- **THEN** a selected copy with the override badge replaces the logo, then neither the copy nor the logo paints on that spread
