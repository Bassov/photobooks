import type { CSSProperties } from 'react'

/** Inline layout tokens so we do not add uncovered .css lines to the patch. */
export const relinkBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 40,
  display: 'grid',
  placeItems: 'center',
  padding: '1rem',
  background: 'color-mix(in srgb, var(--foreground) 35%, transparent)',
}

export const relinkDialogStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 'min(760px, 100%)',
  maxHeight: 'min(520px, 100%)',
  overflow: 'hidden',
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--border)',
  background: 'var(--card)',
  boxShadow: 'var(--shadow-lg)',
  fontFamily: 'var(--font-ui)',
  color: 'var(--foreground)',
}

export const relinkHeadStyle: CSSProperties = {
  padding: '1.1rem 1.35rem 0.6rem',
}

export const relinkTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: 'var(--text-xl)',
  fontWeight: 600,
}

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

export function badgeStyle(found: boolean, status: string): CSSProperties {
  const base: CSSProperties = {
    justifySelf: 'start',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-2xl)',
    fontSize: 'var(--text-eyebrow)',
    fontWeight: 600,
  }
  if (found || status === 'ok') {
    return {
      ...base,
      background: 'var(--badge-success-bg)',
      color: 'var(--badge-success-fg)',
    }
  }
  if (status === 'modified') {
    return {
      ...base,
      background: 'var(--badge-warning-bg)',
      color: 'var(--badge-warning-fg)',
    }
  }
  return {
    ...base,
    background: 'var(--badge-error-bg)',
    color: 'var(--badge-error-fg)',
  }
}
