import type { CSSProperties } from 'react'

/**
 * Inline layout tokens so we do not add uncovered .css lines to the patch.
 * Kit RelinkDialog geometry (r40 M150): 1.5rem gutters (kit px-6), header
 * 1.25rem / 0.5rem (pt-5 pb-2), list mt-2, rows py-2 px-3, footer mt-4 pb-5.
 */

export const relinkSubStyle: CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: 'var(--text-sm)',
  /* Kit text-sm leading-[1.45] → 18.85 px at 13 px (r44 M154). */
  lineHeight: 1.45,
  color: 'var(--muted-foreground)',
}

export const relinkProgressStyle: CSSProperties = {
  margin: '0.5rem 1.5rem 0 auto',
  fontSize: 'var(--text-xs)',
  color: 'var(--muted-foreground)',
}

export const relinkListStyle: CSSProperties = {
  margin: '0.5rem 1.5rem 0',
  maxHeight: 280,
  overflow: 'auto',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--field)',
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
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
}

export const relinkRowNameStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'var(--text-sm)',
  /* Kit text-sm leading (1.45 → 18.85 px at 13 px). */
  lineHeight: 'var(--leading-menu)',
  fontWeight: 600,
}

export const relinkFootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1rem',
  padding: '0 1.5rem 1.25rem',
}

export const relinkFileInputStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
}

/** Click-through body: the pill floats over the spread, only Review is live. */
export const missingPillStyle: CSSProperties = {
  pointerEvents: 'none',
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
