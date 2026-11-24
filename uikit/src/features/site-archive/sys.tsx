/* Archive shell for demos 6–8: main's personal-site shell (features/site/sys, the stand's site-sys grown up) plus the two
   things the stand shell had and the personal site dropped: the dark wall (demo 6, archive.css) and the demo-only
   "Books 1 · 3 · 6 · 12 · 30 · 100" switch. */
import * as React from 'react'
import { SAMPLE_SITE_TEXTS } from '@/features/site/sample'
import { SysSite as Site, type HomeApi } from '@/features/site/sys'
import { COUNTS } from '@/features/site-book/many'
import { href } from '@/kit/router'
import './archive.css'

export { metaOf, reduced, Statement, type Grid, type HomeApi } from '@/features/site/sys'
/** the stand's home lead = the sample intro */
export const LEAD = SAMPLE_SITE_TEXTS.intro

/** "Books 1 · 3 · 6 · …": `?books=` on the archive route (site-book/many reads it) */
export function BooksSwitch({ slug, counts = COUNTS }: { slug: string; counts?: readonly number[] }) {
  const n = Number(/[?&]books=(\d+)/.exec(location.hash)?.[1] ?? 6)
  return (
    <nav className="sa-switch" aria-label="Books" data-testid="sa-switch">
      <span>Books</span>
      {counts.map((c) => (
        <a key={c} href={`${href.archive(slug)}?books=${c}`} aria-current={c === n ? 'true' : undefined}>{c}</a>
      ))}
    </nav>
  )
}

export function SysSite({ n, dark, home }: { n: number; dark?: boolean; home: (h: HomeApi) => React.ReactNode }) {
  return (
    <div className={dark ? 'sa-sys sa-dark' : 'sa-sys'} data-testid={`ss${n}`}>
      <Site home={home} />
      <BooksSwitch slug={`site-demo-${n}`} />
    </div>
  )
}
