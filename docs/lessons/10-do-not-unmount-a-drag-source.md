# Lesson 10

Do not unmount a drag source during drop. `dragend` on a detached node never reaches `document`, so a click-suppress flag armed at `dragstart` stays stuck.
