## ADDED Requirements

### Requirement: Frame context menu, arrange shortcuts and lock

Right-clicking an editor frame (or Shift+F10 on a focused one) SHALL select it and open a menu with Bring to front, Bring forward, Send backward, Send to back and Lock / Unlock, dispatching the same ops as the inspector Arrange buttons and lock toggle; a move that cannot change the order is hidden, never disabled. Ctrl/Cmd+] / Ctrl/Cmd+[ SHALL bring the selected frame forward / send it backward, with Shift to the front / back, and Ctrl/Cmd+Shift+L SHALL toggle its lock. A locked frame SHALL NOT move, resize, start a photo drag or accept a dropped photo; unlocking restores all of these.

#### Scenario: Send behind from the menu

- **WHEN** the user right-clicks the top of two overlapping frames and picks Send to back
- **THEN** the other frame is on top at the overlap and the inspector shows layer 1 for the clicked frame

#### Scenario: Locked frame ignores drag and drop

- **WHEN** a frame is locked and the user drags it or drops a filmstrip photo onto it
- **THEN** its box is unchanged, it shows no resize handles and it stays empty; after Ctrl/Cmd+Shift+L a drag moves it
