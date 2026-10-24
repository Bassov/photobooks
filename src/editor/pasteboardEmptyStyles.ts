import type { CSSProperties } from 'react'

/** Overlay that centers the empty card without intercepting pasteboard hits. */
export const pasteboardEmptyOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
}

/**
 * EmptyState card on the pasteboard (kit Empty scenario).
 * Card shell stays pointer-events:none so space-drag/pan hits the pasteboard;
 * only the action row re-enables hits for Choose photo folder.
 */
export const pasteboardEmptyCardStyle: CSSProperties = {
  pointerEvents: 'none',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: '22.5rem',
  boxShadow: 'var(--shadow-lg)',
  background: 'var(--popover)',
}

export const pasteboardEmptyActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'calc(var(--spacing) * 2)',
  justifyContent: 'center',
  width: '100%',
  pointerEvents: 'auto',
}

/** Non-blocking first-placement hint; never captures pointer events. */
export const pasteboardPlacementHintStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 'calc(var(--spacing) * 14)',
  zIndex: 20,
  transform: 'translateX(-50%)',
  maxWidth: 'min(28rem, 90%)',
  padding: 'calc(var(--spacing) * 2) calc(var(--spacing) * 3)',
  borderRadius: 'var(--radius-md)',
  background: 'color-mix(in srgb, var(--popover) 92%, transparent)',
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.4,
  textAlign: 'center',
  pointerEvents: 'none',
}
