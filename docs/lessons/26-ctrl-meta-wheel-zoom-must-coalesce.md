# Lesson 26

Ctrl/meta wheel zoom must coalesce deltas to one apply per animation frame — a same-task burst of `wheel` events (trackpad or Playwright `dispatchCtrlWheel`) otherwise packs many `zoomAtPoint` calls into one LoAF.
