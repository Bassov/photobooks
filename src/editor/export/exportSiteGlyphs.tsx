import type { ReactNode } from 'react'
import { cx } from '../../ui/className'
import '../../ui/Icon.css'

/**
 * Lucide `circle-check`, `circle-alert`, `external-link`, `loader-circle` and `folder`, drawn like `Icon` (24 grid,
 * stroke 2). Kept here because `src/ui/icons/glyphs.ts` belongs to another lane.
 */
function Glyph({
  size,
  name,
  className,
  children,
}: {
  size: 16 | 20
  name: string
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      className={cx('pb-icon', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-size={size}
      data-icon={name}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function CircleCheckGlyph({ size }: { size: 16 | 20 }) {
  return (
    <Glyph size={size} name="circle-check">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Glyph>
  )
}

/** Closed folder, like the kit's lucide `Folder` (the `folder` Icon is open). */
export function FolderGlyph() {
  return (
    <Glyph size={16} name="folder">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </Glyph>
  )
}

/** Lucide `circle-alert` (Print check error rows). */
export function CircleAlertGlyph() {
  return (
    <Glyph size={16} name="circle-alert">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </Glyph>
  )
}

/** Lucide `external-link` (Print "Open PDF"). */
export function ExternalLinkGlyph() {
  return (
    <Glyph size={16} name="external-link">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Glyph>
  )
}

export function LoaderGlyph({ size }: { size: 16 | 20 }) {
  return (
    <Glyph size={size} name="loader" className="export-site-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Glyph>
  )
}
