import type { CSSProperties } from 'react'

/** Inline layout tokens so we do not add uncovered .css lines to the patch. */

export const relinkSubStyle: CSSProperties = {
  margin: '0.35rem 0 0',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.4,
  color: 'var(--muted-foreground)',
}

export const relinkProgressStyle: CSSProperties = {
  margin: '0.5rem 1.35rem 0 auto',
  fontSize: 'var(--text-xs)',
  color: 'var(--muted-foreground)',
}

export const relinkListStyle: CSSProperties = {
  margin: '0.75rem 1.35rem 0',
  maxHeight: 280,
  overflow: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

export const relinkEmptyStyle: CSSProperties = {
  margin: 0,
  padding: '1.5rem',
  textAlign: 'center',
  fontSize: 'var(--text-sm)',
  color: 'var(--muted-foreground)',
}

export const relinkRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: '0.85rem',
  padding: '0.55rem 0.85rem',
  borderBottom: '1px solid var(--border)',
}

export const relinkRowNameStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
}

export const relinkFootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '0.85rem',
  padding: '0.85rem 1.35rem',
  borderTop: '1px solid var(--border)',
}

export const relinkFileInputStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
}

export const missingPillStyle: CSSProperties = {
  position: 'absolute',
  top: '0.7rem',
  left: '50%',
  zIndex: 30,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.55rem',
  transform: 'translateX(-50%)',
  padding: '0.35rem 0.7rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--badge-warning-ring)',
  background: 'var(--card)',
  boxShadow: 'var(--shadow-md)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  color: 'var(--foreground)',
}
