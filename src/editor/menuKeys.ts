/**
 * Designer frame-context-menu M7: menu shortcut text keeps today's strings
 * ("Shift+Ctrl+]", "Ctrl+Shift+L"); on macOS it shows glyphs instead,
 * Ctrl → ⌘, Shift → ⇧ (⇧ before ⌘), Del → ⌫, with no "+" (kit
 * `frame-menu.tsx` `menuKeys`).
 */
const GLYPH: Readonly<Record<string, string>> = {
  Ctrl: '⌘',
  Shift: '⇧',
  Del: '⌫',
}

const MOD_ORDER = ['⇧', '⌘']

export function menuKeys(keys: string, mac: boolean): string {
  if (!mac) {
    return keys
  }
  const parts = keys.split('+').map((key) => GLYPH[key] ?? key)
  const mods = MOD_ORDER.filter((mod) => parts.includes(mod))
  return [...mods, ...parts.filter((part) => !MOD_ORDER.includes(part))].join(
    '',
  )
}
