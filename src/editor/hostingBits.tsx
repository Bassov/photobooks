import type { ReactNode } from 'react'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import './export/ExportSiteButton.css'
import { ERR } from './hostingStyles'

/* Settings → Hosting bits shared by the manual form, the connected card and the guided setup (kit
   demo-parts/hostingBits.tsx). */

/** Kit ghost `size="xs"` (Change, CORS Copy) on a `ghost sm` Button: unlayered Button.css beats plain utilities. */
export const XS_GHOST = 'h-7! px-2! text-xs! font-medium text-foreground!'

/** Both labels sit in one grid cell, so the button keeps its width (the D36 Share rule). */
export function Swap({
  on,
  rest,
  busy,
}: {
  on: boolean
  rest: ReactNode
  busy: ReactNode
}) {
  return (
    <span className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <span
        className={cn(
          'flex items-center justify-center gap-1.5',
          on && 'invisible',
        )}
      >
        {rest}
      </span>
      <span
        className={cn(
          'flex items-center justify-center gap-1.5',
          !on && 'invisible',
        )}
      >
        {busy}
      </span>
    </span>
  )
}

export function CheckingLabel() {
  return (
    <>
      <Spinner />
      Checking…
    </>
  )
}

/** Lucide `loader-circle` at 14 px (kit Loader2 size-3.5); `LoaderGlyph` only draws 16 | 20. */
function Spinner() {
  return (
    <svg
      className="pb-icon export-site-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-size={14}
      data-icon="loader"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export function Fail({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex gap-2 text-sm"
      style={{ color: ERR }}
      role="alert"
      data-testid="hosting-error"
    >
      <Icon name="warning" size={16} className="mt-0.5" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}
