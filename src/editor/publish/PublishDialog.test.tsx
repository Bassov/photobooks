import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook } from '../../core/testing/fixtures'
import type { HostingSummary } from '../../publish/credentials'
import { resetBookStore } from '../bookStore'
import { otherPublishedTitles } from '../export/exportSiteRun'
import { PublishDialog, type PublishView } from './PublishDialog'
import { PUBLISH_IDLE, publishStore } from './publishStore'
import type { PublishFailure } from './publishText'
import { startPublish } from './startPublish'

vi.mock('../export/exportSiteRun', () => ({
  otherPublishedTitles: vi.fn(() => Promise.resolve([])),
}))
vi.mock('./startPublish', () => ({
  startPublish: vi.fn(() => {
    publishStore.dispatch({ type: 'start' })
  }),
}))

const hosting: HostingSummary = {
  accountId: 'acc',
  bucket: 'my-books',
  accessKeyTail: '9f2c',
  publicBaseUrl: 'https://books.example.com',
  status: null,
}
const done = {
  summary: { uploaded: 14, bytes: 3_210_000, removed: 0, unchanged: 186 },
  bookUrl: 'https://books.example.com/books/lake/',
  homeUrl: 'https://books.example.com/',
}

function settle(): void {
  publishStore.dispatch({
    type: 'failed',
    failure: { code: 'other', message: '', sent: 0, total: 0 },
  })
  publishStore.dispatch({ type: 'seen' })
  publishStore.dispatch({ type: 'expire' })
}

function failed(failure: Partial<PublishFailure>): PublishView {
  return {
    kind: 'failed',
    failure: { code: 'timeout', message: '', sent: 0, total: 0, ...failure },
  }
}

function show(initial: PublishView, summary: HostingSummary | null = hosting) {
  const onClose = vi.fn()
  const onOpenHosting = vi.fn()
  render(
    <PublishDialog
      initial={initial}
      hosting={summary}
      onClose={onClose}
      onOpenHosting={onOpenHosting}
    />,
  )
  return { onClose, onOpenHosting }
}

function step(): string | null {
  return screen.getByTestId('publish-dialog').getAttribute('data-step')
}

beforeEach(() => {
  settle()
  resetBookStore({
    book: makeBook({ title: 'Lake' }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  cleanup()
  settle()
  vi.clearAllMocks()
})

describe('PublishDialog', () => {
  it('connect: Cancel closes, the primary opens Settings → Hosting', () => {
    const { onClose, onOpenHosting } = show({ kind: 'connect' }, null)

    expect(screen.getByRole('heading').textContent).toBe('Publish to your site')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('publish-open-hosting'))
    expect(onOpenHosting).toHaveBeenCalledTimes(1)
  })

  it('options: names the book and the host, with the other books once listed', async () => {
    vi.mocked(otherPublishedTitles).mockResolvedValueOnce(['Fog'])
    show({ kind: 'opts' })

    const line = screen.getByTestId('publish-host-line')
    expect(line.textContent).toBe('“Lake” goes to books.example.com.')
    await waitFor(() => {
      expect(line.textContent).toBe(
        '“Lake” goes to books.example.com with the other published books.',
      )
    })
  })

  it('options: shows a public URL it cannot parse as is', () => {
    show({ kind: 'opts' }, { ...hosting, publicBaseUrl: 'not a url' })

    expect(screen.getByTestId('publish-host-line').textContent).toBe(
      '“Lake” goes to not a url.',
    )
  })

  it('Publish starts a run and follows it to Done in place', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    show({ kind: 'opts' })

    fireEvent.click(screen.getByTestId('publish-go'))
    expect(startPublish).toHaveBeenCalledWith(false)
    expect(step()).toBe('run')
    expect(screen.getByTestId('publish-phase').textContent).toBe(
      'Rendering web images · 0%',
    )

    act(() => {
      publishStore.dispatch({ type: 'done', ...done })
    })
    await waitFor(() => {
      expect(step()).toBe('done')
    })
    expect(screen.getByTestId('publish-link').textContent).toBe(done.bookUrl)
    expect(screen.getByTestId('publish-summary').textContent).toBe(
      '14 changed files uploaded · 3.2 MB. 186 were already up to date.',
    )
    fireEvent.click(screen.getByTestId('publish-open-site'))
    expect(open).toHaveBeenCalledWith(
      'https://books.example.com/',
      '_blank',
      'noopener,noreferrer',
    )
    open.mockRestore()
  })

  it('run: a failure replaces the run in place', async () => {
    act(() => {
      publishStore.dispatch({ type: 'start' })
    })
    show({ kind: 'run' })

    act(() => {
      publishStore.dispatch({
        type: 'failed',
        failure: { code: 'timeout', message: '', sent: 0, total: 3 },
      })
    })

    await waitFor(() => {
      expect(step()).toBe('failed')
    })
  })

  it('run: Hide only closes; the run goes on', () => {
    act(() => {
      publishStore.dispatch({ type: 'start' })
    })
    const { onClose } = show({ kind: 'run' })

    fireEvent.click(screen.getByTestId('publish-hide'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(publishStore.getSnapshot().kind).toBe('running')
  })

  it('failed: says how much went up and Try again sends the rest', () => {
    show(failed({ sent: 12, total: 40 }))

    expect(screen.getByTestId('publish-error').textContent).toBe(
      "Cloudflare didn't answer in 30 seconds. 12 of 40 files went up. Try again to send the rest.",
    )
    fireEvent.click(screen.getByTestId('publish-retry'))

    expect(startPublish).toHaveBeenCalledWith(true)
    expect(step()).toBe('run')
  })

  it('failed key: names the bucket-free cause and sends to Hosting', () => {
    const { onOpenHosting } = show(failed({ code: 'key' }))

    expect(screen.queryByTestId('publish-retry')).toBeNull()
    fireEvent.click(screen.getByTestId('publish-open-hosting'))
    expect(onOpenHosting).toHaveBeenCalledTimes(1)
  })

  it('failed denied: names the stored bucket', () => {
    show(failed({ code: 'denied' }))

    expect(screen.getByTestId('publish-error').textContent).toContain(
      '“my-books”',
    )
  })

  it('closing a failure marks it seen', () => {
    act(() => {
      publishStore.dispatch({ type: 'start' })
      publishStore.dispatch({
        type: 'failed',
        failure: { code: 'timeout', message: '', sent: 0, total: 0 },
      })
    })
    const { onClose } = show(failed({}))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(publishStore.getSnapshot()).toBe(PUBLISH_IDLE)
  })

  it('Esc closes like Cancel', () => {
    const { onClose } = show({ kind: 'opts' })

    fireEvent.keyDown(screen.getByTestId('publish-go'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('failed without stored hosting still words the cause', () => {
    show(failed({ code: 'unconnected' }), null)

    expect(screen.getByTestId('publish-error').textContent).toBe(
      'Connect your hosting in Settings → Hosting first.',
    )
  })

  it('run: a run that is not going shows the end of the bar', () => {
    show({ kind: 'run' })

    expect(screen.getByTestId('publish-phase').textContent).toBe(
      'Finishing · 100%',
    )
  })

  it('options: no other published books leaves the plain line', async () => {
    show({ kind: 'opts' })

    await waitFor(() => {
      expect(otherPublishedTitles).toHaveBeenCalledTimes(1)
    })
    await Promise.resolve()
    expect(screen.getByTestId('publish-host-line').textContent).toBe(
      '“Lake” goes to books.example.com.',
    )
  })
})
