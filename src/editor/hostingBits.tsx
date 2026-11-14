import type { ReactNode } from 'react'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import { LoaderGlyph } from './export/exportSiteGlyphs'
import './export/ExportSiteButton.css'
import { ERR } from './hostingStyles'

/* Settings → Hosting bits shared by the manual form, the connected card and the guided setup (kit
   demo-parts/hostingBits.tsx). */

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
      <span className="grid size-3.5 place-items-center [&_svg]:size-3.5">
        <LoaderGlyph size={16} />
      </span>
      Checking…
    </>
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
      <Icon name="warning" size={16} className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}
