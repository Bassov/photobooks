import type { CSSProperties } from 'react'

/** Compact EmptyState chrome inside the filmstrip scrollport (avoids new .css lines). */
export const filmstripEmptyStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  padding: 0,
  gap: 0,
  maxWidth: '100%',
  width: '100%',
  boxSizing: 'border-box',
}

export const filmstripEmptyTitleStyle: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  fontWeight: 400,
  lineHeight: 1.35,
  color: 'var(--muted-foreground)',
}

/** Determinate import ProgressBar sizing in the status strip. */
export const filmstripImportProgressStyle: CSSProperties = {
  width: 'min(12rem, 40vw)',
  flex: '0 1 auto',
  alignSelf: 'center',
}
