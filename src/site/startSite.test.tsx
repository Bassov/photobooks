import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderSitePage } from './renderSitePage'
import { prerenderSample } from './sampleShell'
import { sampleSiteInput } from './sampleSite'
import { sampleLoad, startSite } from './startSite'

const perf = vi.hoisted(() => ({ enablePerfHooks: vi.fn() }))
vi.mock('../perf/exposePerf', () => perf)

function shell(withRoot = true): void {
  // as site.html: the book page's grey until the sample says otherwise
  document.head.innerHTML = '<meta name="theme-color" content="#E1E1E1">'
  document.body.innerHTML = withRoot
    ? '<div id="site-root" class="site"></div>'
    : ''
}

async function start(search = ''): Promise<void> {
  await act(async () => {
    await startSite(document, search)
  })
}

const testId = (id: string) => document.querySelector(`[data-testid="${id}"]`)

afterEach(() => {
  document.body.replaceChildren()
  document.title = ''
  perf.enablePerfHooks.mockClear()
})

describe('prerenderSample', () => {
  it('puts the sample page markup, data and title into the document', () => {
    shell()

    prerenderSample(document, '?book=sea')

    expect(testId('site-room')).not.toBeNull()
    expect(testId('site-about')?.textContent).toMatch(/^Sea/)
    expect(document.getElementById('site-data')?.textContent).toContain(
      '"kind":"book"',
    )
    expect(document.title).toBe('Sea · Sample photobooks')
  })

  it('leaves a document without #site-root alone', () => {
    shell(false)

    prerenderSample(document, '')

    expect(document.body.innerHTML).toBe('')
    expect(document.title).toBe('')
  })
})

describe('startSite', () => {
  it('hydrates the page from #site-data without prerendering the sample', async () => {
    const page = new DOMParser().parseFromString(
      renderSitePage(sampleSiteInput('?book=alps'), { css: [] }),
      'text/html',
    )
    document.body.replaceChildren(...page.body.childNodes)

    await start('?book=sea')

    expect(testId('site-about')?.textContent).toMatch(/^Alps/)
    // Hydrated: the pager answers.
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="site-next"]')
        ?.click()
    })
    await vi.waitFor(() => {
      expect(testId('site-label')?.textContent).toBe('Page 1 of 20')
    })
    expect(document.querySelectorAll('#site-data')).toHaveLength(1)
    expect(perf.enablePerfHooks).not.toHaveBeenCalled()
  })

  it('prerenders and hydrates the sample when the page has no data', async () => {
    shell()

    await start('')

    expect(testId('site-home')).not.toBeNull()
    expect(document.querySelectorAll('[data-testid="ss9-book"]')).toHaveLength(
      3,
    )
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
    ).toBe('#f4f3f0')
  })

  it('prerenders the sample into a shell without a theme-color meta', async () => {
    shell()
    document.head.replaceChildren()

    await start('')

    expect(testId('site-home')).not.toBeNull()
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull()
  })

  it('loads the perf hooks on ?perf=1', async () => {
    shell()

    await start('?book=sea&perf=1')

    expect(perf.enablePerfHooks).toHaveBeenCalledTimes(1)
    expect(testId('site-room')).not.toBeNull()
  })

  it('opens a sample book over the home from its link, built on the client', async () => {
    shell()
    await start('')

    act(() => {
      document
        .querySelector<HTMLAnchorElement>(
          '[data-testid="ss9-book"][data-book="sea"]',
        )
        ?.click()
    })
    await vi.waitFor(() => {
      expect(testId('site-room')).not.toBeNull()
    })

    expect(testId('site-home')).not.toBeNull()
    expect(testId('site-room')?.hasAttribute('data-over')).toBe(true)
    expect(testId('site-about')?.textContent).toMatch(/^Sea/)
    expect(window.location.search).toBe('?book=sea')
    window.history.replaceState(null, '', '/')
  })

  it('builds sample books from links relative to the page, and nothing else', async () => {
    window.history.replaceState(null, '', '/x/site.html')
    const book = await sampleLoad(document)('site.html?book=lake')
    expect(book.entry.id).toBe('lake')
    await expect(sampleLoad(document)('site.html')).rejects.toThrow(
      'no sample book: site.html',
    )
    // a document without a window: its base URI resolves the link
    const detached = {
      defaultView: null,
      baseURI: 'https://example.test/site.html?book=alps',
    } as unknown as Document
    const sea = await sampleLoad(detached)('?book=sea')
    expect(sea.entry.id).toBe('sea')
    window.history.replaceState(null, '', '/')
  })

  it('does nothing without #site-root', async () => {
    shell(false)

    await start('')

    expect(document.body.innerHTML).toBe('')
  })
})
