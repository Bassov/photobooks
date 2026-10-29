/* Stage 3: editor slot sizes shared by every standalone part and feature page. The values are the EditorFrame layout
   (sandbox/chrome.tsx: left panel 212 px, inspector 300 px) at the 1440×900 #/demo viewport.
   qa measures the real editor panels against these numbers, so any drift fails qa. */
export const SLOT = {
  /** #/demo viewport */ app: { w: 1440, h: 900 },
  /** spread list (EditorFrame left panel) */ left: 212,
  /** inspector (EditorFrame right panel) */ right: 300,
} as const
