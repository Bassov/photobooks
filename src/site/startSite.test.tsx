import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderSitePage } from './renderSitePage'
import { prerenderSample } from './sampleShell'
import { sampleSiteInput } from './sampleSite'
import { startSite } from './startSite'

const perf = vi.hoisted(() => ({ enablePerfHooks: vi.fn() }))
vi.mock('../perf/exposePerf', () => perf)

function shell(withRoot = true): void {
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

    expect(testId('site-title')?.textContent).toBe('Sea')
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

    expect(testId('site-title')?.textContent).toBe('Alps')
    // Hydrated: the pager answers.
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="Next spread"]')
        ?.click()
    })
    expect(testId('site-page-indicator')?.textContent).toBe('Page 1 · 1 / 11')
    expect(document.querySelectorAll('#site-data')).toHaveLength(1)
    expect(perf.enablePerfHooks).not.toHaveBeenCalled()
  })

  it('prerenders and hydrates the sample when the page has no data', async () => {
    shell()

    await start('')

    expect(testId('site-catalog')).not.toBeNull()
    expect(document.querySelectorAll('[data-testid="site-book"]')).toHaveLength(
      3,
    )
  })

  it('loads the perf hooks on ?perf=1', async () => {
    shell()

    await start('?book=sea&perf=1')

    expect(perf.enablePerfHooks).toHaveBeenCalledTimes(1)
    expect(testId('site-book-page')).not.toBeNull()
  })

  it('does nothing without #site-root', async () => {
    shell(false)

    await start('')

    expect(document.body.innerHTML).toBe('')
  })
})
