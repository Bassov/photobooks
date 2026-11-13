import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type SyntheticEvent,
} from 'react'
import { fetchBook, type LoadBook } from './loadBook'
import { SiteHome } from './SiteHome'
import type { SitePageInput } from './siteInput'
import { siteTitle } from './siteModel'
import { SiteRoom, type BookInput } from './SiteRoom'
import { pageHref } from './siteUrl'

/** One site page: the tree `renderSitePage` prerenders and `main.tsx` hydrates. */
export function SiteApp({
  input,
  load = fetchBook,
}: {
  input: SitePageInput
  load?: LoadBook | undefined
}) {
  return input.kind === 'catalog' ? (
    <SiteHomeRooms input={input} load={load} />
  ) : (
    <SiteRoom input={input} />
  )
}

const bookTitle = (b: BookInput) =>
  `${b.entry.title} · ${siteTitle(b.site.title)}`

/**
 * The home with its books' rooms (D41): a book link opens the room over the
 * home (the room fades in, the cover turns at once) and pushes the book URL;
 * its input is fetched on hover / focus. "All books", Esc and Back return to
 * the home with one history step, focus back on the book.
 */
function SiteHomeRooms({
  input,
  load,
}: {
  input: Extract<SitePageInput, { kind: 'catalog' }>
  load: LoadBook
}) {
  const [open, setOpen] = useState<BookInput | null>(null)
  const cache = useRef(new Map<string, Promise<BookInput>>())
  const from = useRef<HTMLAnchorElement | null>(null)
  const homeTitle = useRef('')
  const read = (href: string) => {
    let p = cache.current.get(href)
    if (p === undefined) {
      p = load(href)
      // a failed read is retried by the next hover; the click falls back to the page
      p.catch(() => {
        cache.current.delete(href)
      })
      cache.current.set(href, p)
    }
    return p
  }
  const bookLink = (e: SyntheticEvent) =>
    e.target instanceof Element
      ? e.target.closest<HTMLAnchorElement>('a[data-book]')
      : null
  const hrefOf = (a: HTMLAnchorElement) =>
    input.books.find((b) => b.id === a.dataset.book)?.href

  const show = (b: BookInput) => {
    if (homeTitle.current === '') homeTitle.current = document.title
    document.title = bookTitle(b)
    setOpen(b)
  }
  const hide = () => {
    setOpen(null)
    if (homeTitle.current !== '') document.title = homeTitle.current
    from.current?.focus({ preventScroll: true })
  }
  const live = useRef({ show, hide, read })
  useEffect(() => {
    live.current = { show, hide, read }
  })
  useEffect(() => {
    const pop = (e: PopStateEvent) => {
      const href = (e.state as { siteBook?: unknown } | null)?.siteBook
      if (typeof href !== 'string') {
        live.current.hide()
        return
      }
      void live.current.read(href).then(live.current.show, () => {
        window.location.reload()
      })
    }
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('popstate', pop)
    }
  }, [])

  const prefetch = (e: SyntheticEvent) => {
    const a = bookLink(e)
    const href = a ? hrefOf(a) : undefined
    if (href !== undefined) void read(href).catch(() => undefined)
  }
  const click = (e: MouseEvent) => {
    const a = bookLink(e)
    const href = a ? hrefOf(a) : undefined
    if (
      !a ||
      href === undefined ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return
    }
    e.preventDefault()
    from.current = a
    void read(href).then(
      (b) => {
        window.history.pushState({ siteBook: href }, '', pageHref(href))
        show(b)
      },
      () => {
        window.location.assign(pageHref(href))
      },
    )
  }
  return (
    <div
      style={{ display: 'contents' }}
      onPointerOver={prefetch}
      onFocus={prefetch}
      onClick={click}
    >
      <SiteHome input={input} />
      {open && (
        <SiteRoom
          key={open.entry.id}
          input={open}
          over
          onClose={() => {
            window.history.back()
          }}
        />
      )}
    </div>
  )
}
