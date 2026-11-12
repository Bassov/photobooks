import { act, cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from './sampleSite'
import { caseLayout, shelfBook } from './shelf'
import { SiteApp } from './SiteApp'
import type { SitePageInput } from './siteInput'

const drawHomeBook =
  vi.fn<
    (host: HTMLElement, b: { id: string }, s: number) => Promise<() => void>
  >()
vi.mock('./book/book3dGl', () => ({ drawHomeBook }))

type Catalog = Extract<SitePageInput, { kind: 'catalog' }>
const catalog = (search = ''): Catalog => {
  const input = sampleSiteInput(search)
  if (input.kind !== 'catalog') throw new Error('catalog expected')
  return input
}

/** `n` books cycled from the sample, each its own id and page count */
const many = (n: number): Catalog => {
  const input = catalog()
  const books = Array.from({ length: n }, (_, i) => {
    const b = input.books[i % input.books.length] ?? input.books[0]
    return { ...b, id: `book-${String(i)}`, pageCount: 6 + ((i * 7) % 40) }
  }) as Catalog['books']
  return { ...input, books }
}
const ids = (bay: HTMLElement | undefined) =>
  [...(bay?.querySelectorAll('[data-testid="ss9-book"]') ?? [])].map((a) =>
    a.getAttribute('data-book'),
  )

const size = { width: 1440, height: 900 }
const resize = (width: number, height: number) => {
  Object.assign(size, { width, height })
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}
const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 5)
  })
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => size.width,
  )
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => size.height,
  )
  Object.assign(size, { width: 1440, height: 900 })
  drawHomeBook.mockReset()
  drawHomeBook.mockResolvedValue(() => undefined)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SiteHome', () => {
  it('heads with the author and leads with the intro (D37)', () => {
    render(<SiteApp input={catalog()} />)

    expect(screen.getByTestId('site-name').textContent).toBe('A. Photographer')
    expect(screen.getByTestId('site-lead').textContent).toBe(
      'Travel books from three summers, printed and bound by hand.',
    )
    expect(screen.queryByText('All books')).toBeNull()
  })

  it('falls back to the site title and no lead without author or intro', () => {
    const input = catalog()
    render(<SiteApp input={{ ...input, site: { title: 'Lakes' } }} />)

    expect(screen.getByTestId('site-name').textContent).toBe('Lakes')
    expect(screen.queryByTestId('site-lead')).toBeNull()
  })

  it('shelves every book once as a link to its page', () => {
    render(<SiteApp input={catalog()} />)

    const links = screen.getAllByTestId('ss9-book')
    expect(
      links.map((a) => [a.getAttribute('data-book'), a.getAttribute('href')]),
    ).toStrictEqual([
      ['alps', './site.html?book=alps'],
      ['sea', './site.html?book=sea'],
      ['lake', './site.html?book=lake'],
    ])
    expect(links.every((a) => a.tagName === 'A')).toBe(true)
    expect(links[0]?.getAttribute('data-kind')).toBe('face')
    expect(links[1]?.getAttribute('aria-label')).toBe('Sea, 2023, 6 pages')
    expect(links[1]?.textContent).toBe('Sea2023')
  })

  it('lays the case out for the client viewport, then shows it', () => {
    Object.assign(size, { width: 390, height: 844 })
    render(<SiteApp input={catalog()} />)

    const box = screen.getByTestId('site-case')
    const want = caseLayout(catalog().books.map(shelfBook), 390, 844)
    expect(box.hasAttribute('data-laid')).toBe(true)
    expect(box.style.height).toBe(`${String(want.height)}px`)
    expect(box.style.getPropertyValue('--z')).toBe('1')
    expect(screen.getAllByTestId('site-bay')).toHaveLength(want.rows.length)
  })

  it('prerenders the case hidden (no laid flag) at 1440 × 900', () => {
    const html = renderToString(<SiteApp input={catalog()} />)
    const want = caseLayout(catalog().books.map(shelfBook), 1440, 900)

    expect(html).toContain('data-testid="site-case"')
    expect(html).not.toContain('data-laid')
    expect(html).toContain(`height:${String(want.height)}px`)
  })

  it('shelves a long list: bays in x order, spines, flats, shelves between rows', () => {
    const input = many(60)
    const want = caseLayout(input.books.map(shelfBook), 1440, 900)
    render(<SiteApp input={input} />)

    const bays = screen.getAllByTestId('site-bay')
    expect(bays.map((bay) => ids(bay))).toStrictEqual(
      want.rows.map((r) =>
        [...r.items].sort((a, b) => a.x - b.x).map((it) => it.b.id),
      ),
    )
    // P3 lays its face, then the stack and run: DOM order is not push order
    expect(
      want.rows.some(
        (r, i) => r.items.map((it) => it.b.id).join() !== ids(bays[i]).join(),
      ),
    ).toBe(true)
    const links = screen.getAllByTestId('ss9-book')
    const items = want.rows.flatMap((r) => r.items)
    const item = (a: HTMLElement) =>
      items.find((it) => it.b.id === a.getAttribute('data-book'))
    expect(
      links.map((a) => [a.className, a.hasAttribute('data-under')]),
    ).toStrictEqual(
      links.map((a) => {
        const it = item(a)
        return [`ss9-${it?.kind ?? ''}`, it?.kind === 'flat' && it.y === 0]
      }),
    )
    expect(links.some((a) => a.className === 'ss9-flat')).toBe(true)
    const px = (v: number) => Math.round(v * 1000) / 1000
    const type = (a: HTMLElement) =>
      `${String(px(parseFloat(a.querySelector<HTMLElement>('.sd-it')?.style.fontSize ?? '')))}px`
    const z = want.z
    expect(
      links.filter((a) => a.className !== 'ss9-face').map(type),
    ).toStrictEqual(
      links
        .filter((a) => a.className !== 'ss9-face')
        .map((a) => {
          const it = item(a)
          const side = it?.kind === 'spine' ? it.w : (it?.h ?? 0)
          return `${String(px(Math.min(13 * z, side * 0.42)))}px`
        }),
    )
    expect(
      [...document.querySelectorAll<HTMLElement>('.ss9-shelf')].map((el) =>
        px(parseFloat(el.style.top)),
      ),
    ).toStrictEqual(want.rows.slice(0, -1).map((r) => px(r.top + r.height)))
  })

  it('reshelves when the books change', () => {
    const { rerender } = render(<SiteApp input={many(60)} />)

    rerender(<SiteApp input={many(4)} />)

    expect(
      screen.getAllByTestId('ss9-book').map((a) => a.getAttribute('data-book')),
    ).toStrictEqual(
      [
        ...(caseLayout(many(4).books.map(shelfBook), 1440, 900).rows[0]
          ?.items ?? []),
      ]
        .sort((a, b) => a.x - b.x)
        .map((it) => it.b.id),
    )
  })

  it('says so when nothing is published, without a case', () => {
    render(<SiteApp input={catalog('?empty=1')} />)

    expect(screen.getByTestId('site-empty').textContent).toBe(
      'No published books yet.',
    )
    expect(screen.queryByTestId('site-case')).toBeNull()
  })
})

describe('Book3D', () => {
  it('prerenders the CSS book: cover photo, title, spine text', () => {
    render(<SiteApp input={catalog()} />)

    const book = screen.getByTestId('book3d')
    expect(book.getAttribute('data-book')).toBe('alps')
    expect(book.querySelector('img')?.getAttribute('src')).toBe(
      '/photos/hi/c18b.jpg',
    )
    expect(book.querySelector('.sd-b3-title')?.textContent).toBe('Alps')
    expect(book.querySelector('.sd-b3-spine')?.textContent).toBe('Alps')
    expect(book.style.getPropertyValue('--board')).toBe('#3e3c3b')
  })

  it('hands the face-out to the lazy GL module after load + idle; undoes it on unmount', async () => {
    const undo = vi.fn()
    drawHomeBook.mockResolvedValue(undo)
    const { unmount } = render(<SiteApp input={catalog()} />)

    await vi.waitFor(() => {
      expect(drawHomeBook).toHaveBeenCalled()
    })
    const [host, b, s] = drawHomeBook.mock.lastCall ?? []
    expect(host).toBe(screen.getByTestId('book3d'))
    expect(b?.id).toBe('alps')
    expect(s).toBeCloseTo(
      caseLayout(catalog().books.map(shelfBook), 1440, 900).s,
    )
    await flush()
    expect(undo).not.toHaveBeenCalled()
    unmount()
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('undoes a draw that lands after unmount', async () => {
    const undo = vi.fn()
    let land: (u: () => void) => void = () => undefined
    drawHomeBook.mockReturnValue(
      new Promise((resolve) => {
        land = resolve
      }),
    )
    const { unmount } = render(<SiteApp input={catalog()} />)
    await vi.waitFor(() => {
      expect(drawHomeBook).toHaveBeenCalled()
    })

    unmount()
    land(undo)
    await flush()

    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('redraws for a new scale and skips the stale one', async () => {
    const undo = vi.fn()
    drawHomeBook.mockResolvedValue(undo)
    render(<SiteApp input={catalog()} />)
    resize(1920, 1080)
    await vi.waitFor(() => {
      expect(drawHomeBook).toHaveBeenCalled()
    })
    await flush()
    const s1920 = caseLayout(catalog().books.map(shelfBook), 1920, 1080).s
    expect(drawHomeBook.mock.calls.map(([, , s]) => s)).toStrictEqual([s1920])

    resize(390, 844)
    await vi.waitFor(() => {
      expect(drawHomeBook).toHaveBeenCalledTimes(2)
    })

    expect(undo).toHaveBeenCalledTimes(1)
    expect(drawHomeBook.mock.lastCall?.[2]).toBe(
      caseLayout(catalog().books.map(shelfBook), 390, 844).s,
    )
  })

  it('grooves the hinge from 6 px/cm', () => {
    const { unmount } = render(<SiteApp input={catalog()} />)
    expect(document.querySelector('.sd-b3-groove')).not.toBeNull()
    unmount()

    // a 2 m wide book on a phone shrinks the scale under 4 px/cm
    Object.assign(size, { width: 390, height: 844 })
    const input = catalog()
    const wide = input.books.map((b) => ({
      ...b,
      trimMm: { ...b.trimMm, w: 2000 },
    }))
    render(<SiteApp input={{ ...input, books: wide }} />)
    expect(screen.getAllByTestId('book3d')).toHaveLength(3)
    expect(document.querySelector('.sd-b3-groove')).toBeNull()
  })

  it('keeps the CSS book when the GL module fails', async () => {
    drawHomeBook.mockRejectedValue(new Error('no GL'))
    render(<SiteApp input={catalog()} />)

    await vi.waitFor(() => {
      expect(drawHomeBook).toHaveBeenCalled()
    })
    expect(screen.getByTestId('book3d').hasAttribute('data-gl')).toBe(false)
  })
})
