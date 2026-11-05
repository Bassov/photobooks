import type { ReactNode } from 'react'
import { cx } from '../../ui/className'
import '../../ui/Icon.css'

/**
 * Lucide `circle-check`, `loader-circle` and `folder`, drawn like `Icon` (24 grid,
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

export function LoaderGlyph({ size }: { size: 16 | 20 }) {
  return (
    <Glyph size={size} name="loader" className="export-site-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Glyph>
  )
}
