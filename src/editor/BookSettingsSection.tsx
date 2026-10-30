import { useSyncExternalStore } from 'react'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { SUB, fmtN, pagesOf } from './editorChromeTokens'

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit "Book settings": the settings the document holds, read-only. */
export function BookSettingsSection() {
  const { settings, spreads } = useSyncExternalStore(
    subscribeBookStore,
    readBook,
    readBook,
  )
  const rows: readonly [string, string][] = [
    [
      'Page size',
      `${fmtN(settings.trim.widthMm)} × ${fmtN(settings.trim.heightMm)} mm`,
    ],
    ['Bleed', `${fmtN(settings.bleedMm)} mm`],
    ['Safe margin', `${fmtN(settings.safeMarginMm)} mm`],
    ['Pages', String(pagesOf(spreads.length))],
  ]
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="book-settings"
      aria-label="Book settings"
    >
      <div>
        <h2 className="text-sm font-semibold" data-testid="inspector-context">
          Book settings
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applies to the whole book
        </p>
      </div>
      <h4 className="inspector-eyebrow">Page</h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt style={{ color: SUB }}>{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
