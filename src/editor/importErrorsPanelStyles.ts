import type { CSSProperties } from 'react'

export const importErrorsPanelHeadStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'calc(var(--spacing) * 2)',
  marginBottom: 'calc(var(--spacing) * 3)',
}

export const importErrorsPanelEmptyStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  color: 'var(--muted-foreground)',
}

export const importErrorsPanelListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

export const importErrorsPanelGroupStyle: CSSProperties = {
  marginTop: 'calc(var(--spacing) * 2)',
  borderTop: '1px solid var(--border)',
  paddingTop: 'calc(var(--spacing) * 2)',
}

export const importErrorsPanelSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--foreground)',
}

export const importErrorsPanelEntriesStyle: CSSProperties = {
  ...importErrorsPanelListStyle,
  marginTop: 'calc(var(--spacing) * 1.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'calc(var(--spacing) * 1)',
}

export const importErrorsPanelEntryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'calc(var(--spacing) * 2)',
  minWidth: 0,
}

export const importErrorsPanelNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
}

export const importErrorsPanelNotImportedStyle: CSSProperties = {
  color: 'var(--muted-foreground)',
  fontWeight: 400,
}

export const importErrorsPanelDismissStyle: CSSProperties = {
  flexShrink: 0,
  color: 'var(--destructive)',
}
