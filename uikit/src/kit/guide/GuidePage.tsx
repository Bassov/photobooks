import * as React from 'react'
import { cn } from '@/lib/utils'
import { KitBar } from '../Shell'
import { MANIFEST } from '../pages'
import { href } from '../router'
import {
  CHAPTERS,
  CHAPTER_OF,
  NOT_IN_APP,
  PARTS,
  SHORTCUTS,
  type Chapter,
} from './content'
import { Imposition } from './Imposition'
import { Rich, StatusChip } from './Rich'
import shotData from './shots.json'

type Shot = {
  w: number
  h: number
  callouts: { n: number; x: number; y: number }[]
}
const SHOTS = shotData as Record<string, Shot>
const INDEX_ID = 'feature-index'

const eyebrow =
  'text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'
const focusRing = 'outline-hidden focus-visible:ring-2 focus-visible:ring-ring'
const textLink =
  'rounded-2xs text-sm font-medium text-foreground underline decoration-[#A6A6A6] underline-offset-3 outline-hidden hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const marker =
  'grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-2xs font-semibold leading-none tabular-nums text-white'
const pad = (n: number) => String(n).padStart(2, '0')

/** Scroll a chapter under the KitBar (sections carry scroll-margin-top 72) and record it in the URL without a hashchange. */
function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
  history.replaceState(null, '', href.guide(id))
}

/** The current chapter: the last section inside the band under the KitBar (top third of the viewport). */
function useCurrent(ids: string[], initial: string) {
  const [cur, setCur] = React.useState(initial)
  React.useEffect(() => {
    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es)
          if (e.isIntersecting) seen.add(e.target.id)
          else seen.delete(e.target.id)
        const last = ids.filter((id) => seen.has(id)).pop()
        if (last) setCur(last)
      },
      { rootMargin: '-56px 0px -66% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [ids])
  return [cur, setCur] as const
}

function Toc({
  current,
  onGo,
}: {
  current: string
  onGo: (id: string) => void
}) {
  const link = (id: string, label: string, num: string, coming?: boolean) => (
    <a
      key={id}
      href={href.guide(id)}
      data-guide-link={id}
      aria-current={current === id ? 'location' : undefined}
      onClick={(e) => {
        e.preventDefault()
        onGo(id)
      }}
      className={cn(
        'flex h-7 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-sm px-2.5 text-sm text-muted-foreground hover:bg-field hover:text-foreground',
        'aria-[current]:bg-sel aria-[current]:font-medium aria-[current]:text-foreground [&[aria-current]>.num]:text-foreground',
        focusRing,
      )}
    >
      <span className="num w-[18px] shrink-0 text-xs tabular-nums text-neutral-500">
        {num}
      </span>
      {label}
      {coming && (
        <span
          aria-label="Coming"
          className="ml-auto size-1.5 shrink-0 rounded-full ring-1 ring-inset ring-neutral-500"
        />
      )}
    </a>
  )
  return (
    <nav
      aria-label="Guide chapters"
      data-testid="guide-toc"
      className="scroll-thin sticky top-[96px] flex max-h-[calc(100vh-120px)] flex-col self-start overflow-y-auto"
    >
      <div className={cn(eyebrow, 'ml-2.5')}>Guide</div>
      {PARTS.map((p, i) => (
        <React.Fragment key={p.id}>
          <div className={cn(eyebrow, 'mb-1 ml-2.5', i ? 'mt-4' : 'mt-3')}>
            {p.id} · {p.name}
          </div>
          {CHAPTERS.filter((c) => c.part === p.id).map((c) =>
            link(c.id, c.toc, pad(c.n), !!c.coming),
          )}
        </React.Fragment>
      ))}
      <div className="h-3 shrink-0" />
      {link(INDEX_ID, 'All features', '')}
    </nav>
  )
}

function Hero({ onGo }: { onGo: (id: string) => void }) {
  return (
    <header>
      <div className={eyebrow}>Product guide</div>
      <h1 className="heading mb-3 mt-2 text-3xl leading-tight">
        From a folder of photos to a book on your shelf
      </h1>
      <p className="max-w-[640px] text-lead text-muted-foreground">
        Photobooks turns the photos already on your computer into a printed
        photobook and a personal website. Nothing is uploaded: every book lives
        in a library folder you choose.
      </p>
      <div className="mt-7 grid grid-cols-5 gap-2">
        {PARTS.map((p) => {
          const cs = CHAPTERS.filter((c) => c.part === p.id)
          return (
            <a
              key={p.id}
              href={href.guide(cs[0].id)}
              data-guide-part={p.id}
              onClick={(e) => {
                e.preventDefault()
                onGo(cs[0].id)
              }}
              className={cn(
                'flex flex-col gap-0.5 rounded-lg bg-field px-3.5 pb-3.5 pt-3 hover:bg-accent',
                focusRing,
              )}
            >
              <span className="text-xs tabular-nums text-muted-foreground">
                {pad(cs[0].n)}–{pad(cs[cs.length - 1].n)}
              </span>
              <b className="text-sm font-semibold">{p.name}</b>
              <span className="text-xs leading-[1.4] text-muted-foreground">
                {p.text}
              </span>
            </a>
          )
        })}
      </div>
    </header>
  )
}

function Steps({ steps }: { steps: Chapter['steps'] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li
          key={i}
          className="grid grid-cols-[20px_1fr] gap-2.5 text-sm leading-normal"
        >
          <span className={cn(marker, 'mt-px')}>{i + 1}</span>
          <span>
            <Rich text={s.text} />
            {s.coming && (
              <>
                {' '}
                <StatusChip coming={s.coming} className="align-[1px]" />
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Figure({ c, width }: { c: Chapter; width: number }) {
  const f = c.figure!,
    shot = SHOTS[c.id] ?? { w: 1440, h: 900, callouts: [] }
  return (
    <figure className="m-0">
      <div className="shot relative overflow-hidden rounded-lg bg-field shadow-thumb">
        <img
          src={`guide/${c.id}.jpg`}
          width={width}
          height={Math.round((width * shot.h) / shot.w)}
          alt={`${c.title}: kit demo screenshot`}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
        {shot.callouts.map((m, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              marker,
              'absolute -translate-x-1/2 -translate-y-1/2 shadow-sm ring-2 ring-white',
            )}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            {m.n}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Kit <code className="font-mono text-xs">#/demo</code>, step{' '}
        <code className="font-mono text-xs">{f.step}</code>
      </figcaption>
    </figure>
  )
}

function Shortcuts() {
  return (
    <table
      className="w-full border-collapse text-sm"
      data-testid="guide-shortcuts"
    >
      <caption className={cn(eyebrow, 'mb-1 text-left')}>Shortcuts</caption>
      <tbody>
        {SHORTCUTS.map((k) => (
          <tr key={k.text} className="h-8 border-b border-border">
            <td className="whitespace-nowrap pr-4">
              <Rich text={k.keys} />
            </td>
            <td className="text-muted-foreground"><Rich text={k.text} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChapterSection({ c, first }: { c: Chapter; first: boolean }) {
  const kit = c.kit.filter((slug) => MANIFEST.some((p) => p.slug === slug))
  return (
    <section
      id={c.id}
      data-guide-chapter={c.id}
      aria-labelledby={`${c.id}-h`}
      className={cn(
        'scroll-mt-18 border-t border-border pt-10',
        first ? 'mt-10' : 'mt-12',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xs tabular-nums text-muted-foreground">
          {pad(c.n)}
        </span>
        <StatusChip coming={c.coming} />
      </div>
      <h2
        id={`${c.id}-h`}
        className="mb-2 mt-1.5 font-heading text-2xl font-medium tracking-[-0.01em]"
      >
        {c.title}
      </h2>
      <p className="max-w-[640px] text-md text-foreground">
        <span className="text-muted-foreground">Solves:</span> {c.solves}
      </p>
      {c.legend ? (
        <div className="mt-6">
          <Figure c={c} width={868} />
          <ol className="mt-4 grid grid-cols-5 gap-4">
            {c.legend.map((l, i) => (
              <li
                key={l.name}
                className="grid grid-cols-[20px_1fr] gap-2 text-sm"
              >
                <span className={marker}>{i + 1}</span>
                <span>
                  <b className="block font-semibold">{l.name}</b>
                  <span className="text-muted-foreground">{l.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        c.layout === 'stack' ? (
          <div className="mt-6 flex flex-col gap-6">
            <div className="max-w-[640px]"><Steps steps={c.steps} /></div>
            <Figure c={c} width={868} />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-[340px_504px] items-start gap-6">
            <Steps steps={c.steps} />
            {c.figure ? <Figure c={c} width={504} /> : <Shortcuts />}
          </div>
        )
      )}
      {c.id === 'print-home' && <Imposition />}
      <div className="mt-5 flex flex-wrap gap-4">
        {c.demo && (
          <a href={href.demo} className={textLink}>
            Try it in the demo →
          </a>
        )}
        {kit.map((slug) => (
          <a
            key={slug}
            href={href.feature(slug)}
            className={textLink}
            data-kit-link={slug}
          >
            Kit page: {slug} →
          </a>
        ))}
      </div>
    </section>
  )
}

function FeatureIndex() {
  const num = Object.fromEntries(CHAPTERS.map((c) => [c.id, pad(c.n)]))
  return (
    <section
      id={INDEX_ID}
      aria-labelledby={`${INDEX_ID}-h`}
      className="mt-12 scroll-mt-18 border-t border-border pt-10"
    >
      <span className="text-xs text-muted-foreground">Index</span>
      <h2
        id={`${INDEX_ID}-h`}
        className="mb-2 mt-1.5 font-heading text-2xl font-medium tracking-[-0.01em]"
      >
        All features
      </h2>
      <p className="max-w-[640px] text-md">
        Every kit feature page, the chapter that explains it, and whether it is
        in the app.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-6">
        {MANIFEST.map((p) => (
          <a
            key={p.slug}
            href={href.feature(p.slug)}
            data-feature-row={p.slug}
            className={cn(
              'group grid h-8 grid-cols-[1fr_32px_96px] items-center whitespace-nowrap border-b border-border text-sm',
              focusRing,
            )}
          >
            <span className="truncate group-hover:underline">{p.title}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {num[CHAPTER_OF[p.slug]] ?? '–'}
            </span>
            <span className="justify-self-end">
              <StatusChip coming={NOT_IN_APP[p.slug]} short />
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

const IDS = [...CHAPTERS.map((c) => c.id), INDEX_ID]

/** #/guide — the product walkthrough: every feature in the order the user works, how to use it, what it solves. */
export function GuidePage({ chapter }: { chapter?: string }) {
  const [current, setCurrent] = useCurrent(
    IDS,
    chapter && IDS.includes(chapter) ? chapter : IDS[0],
  )
  const onGo = React.useCallback(
    (id: string) => {
      go(id)
      setCurrent(id)
    },
    [setCurrent],
  )
  React.useEffect(() => {
    if (chapter && IDS.includes(chapter)) {
      document.getElementById(chapter)?.scrollIntoView({ block: 'start' })
      setCurrent(chapter)
    } else window.scrollTo(0, 0)
  }, [chapter, setCurrent])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <KitBar section="guide" />
      <main className="mx-auto grid max-w-[1180px] grid-cols-[200px_868px] gap-x-12 px-8 pb-24 pt-10">
        <Toc current={current} onGo={onGo} />
        <div className="min-w-0" data-testid="guide">
          <Hero onGo={onGo} />
          {CHAPTERS.map((c, i) => (
            <ChapterSection key={c.id} c={c} first={i === 0} />
          ))}
          <FeatureIndex />
          <footer className="mt-12 text-xs text-muted-foreground">
            Screenshots are the kit <code className="font-mono">#/demo</code>{' '}
            walk (<code className="font-mono">pnpm guide:shots</code>). Photos:
            CC0, StockSnap.io; library demo photos from Wikimedia Commons (CC
            BY-SA 4.0) —{' '}
            <a
              href="#/credits"
              className="underline underline-offset-2"
              data-testid="footer-credits"
            >
              Photo credits
            </a>
            .
          </footer>
        </div>
      </main>
    </div>
  )
}
