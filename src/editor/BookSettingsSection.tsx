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
      className="mb-4 flex flex-col gap-3"
      data-testid="book-settings"
      aria-label="Book settings"
    >
      <h4 className="text-2xs font-semibold tracking-[0.12em] uppercase">
        Book settings
      </h4>
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
