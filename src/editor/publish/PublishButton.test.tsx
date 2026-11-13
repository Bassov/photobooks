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
import {
  loadHostingSummary,
  type HostingSummary,
} from '../../publish/credentials'
import { resetBookStore } from '../bookStore'
import { exportSiteStore } from '../export/exportSiteStore'
import { PublishButton } from './PublishButton'
import { publishStore } from './publishStore'

vi.mock('../../publish/credentials', () => ({
  loadHostingSummary: vi.fn(),
}))
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

function settle(): void {
  publishStore.dispatch({
    type: 'failed',
    failure: { code: 'other', message: '', sent: 0, total: 0 },
  })
  publishStore.dispatch({ type: 'seen' })
  publishStore.dispatch({ type: 'expire' })
  exportSiteStore.dispatch({ type: 'failed', code: 'unknown', folder: '' })
  exportSiteStore.dispatch({ type: 'seen' })
}

function pill(): HTMLButtonElement {
  return screen.getByTestId<HTMLButtonElement>('publish')
}

beforeEach(() => {
  settle()
  vi.mocked(loadHostingSummary).mockResolvedValue(hosting)
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

describe('PublishButton', () => {
  it('rests as "Publish" with a hidden rest sizer', () => {
    render(<PublishButton disabled={false} onOpenHosting={vi.fn()} />)

    expect(pill().getAttribute('data-state')).toBe('idle')
    expect(pill().getAttribute('title')).toBe('Publish')
    expect(pill().textContent).toBe('PublishPublish')
    expect(screen.getByTestId('publish-sizer').textContent).toBe('Publish')
    expect(screen.getByRole('status').textContent).toBe('')
    expect(pill().style.getPropertyValue('--site-job-progress')).toBe('')
    // P11: Publish keeps its label at every width.
    expect(pill().querySelector('.site-job-pill__label--narrow')).toBeNull()
  })

  it('is disabled at rest only when the editor says so', () => {
    render(<PublishButton disabled onOpenHosting={vi.fn()} />)
    expect(pill().disabled).toBe(true)

    act(() => {
      publishStore.dispatch({ type: 'start' })
    })
    expect(pill().disabled).toBe(false)
  })

  it('waits while the site export runs (P7)', () => {
    render(<PublishButton disabled={false} onOpenHosting={vi.fn()} />)
    act(() => {
      exportSiteStore.dispatch({ type: 'start' })
    })

    expect(pill().disabled).toBe(true)
    expect(pill().getAttribute('title')).toBe('Wait until the export finishes')
    expect(pill().parentElement?.getAttribute('title')).toBe(
      'Wait until the export finishes',
    )
  })

  it('shows NN% over the fill while running and announces it', async () => {
    render(<PublishButton disabled={false} onOpenHosting={vi.fn()} />)
    act(() => {
      publishStore.dispatch({ type: 'start' })
      publishStore.dispatch({ type: 'progress', percent: 42 })
    })

    await waitFor(() => {
      expect(pill().textContent).toContain('42%')
      expect(screen.getByRole('status').textContent).toBe('Publishing, 42%')
    })
    expect(pill().getAttribute('title')).toBe('Publishing · 42%')
    expect(pill().getAttribute('aria-label')).toBe('Publish')
    expect(pill().style.getPropertyValue('--site-job-progress')).toBe('0.42')
    expect(screen.getByTestId('publish-sizer').textContent).toBe('Publish')
  })

  it('without hosting opens the connect step, which opens Settings → Hosting', async () => {
    vi.mocked(loadHostingSummary).mockResolvedValue(null)
    const onOpenHosting = vi.fn()
    render(<PublishButton disabled={false} onOpenHosting={onOpenHosting} />)

    fireEvent.click(pill())
    const dialog = await screen.findByTestId('publish-dialog')
    expect(dialog.getAttribute('data-step')).toBe('connect')
    fireEvent.click(screen.getByTestId('publish-open-hosting'))

    expect(onOpenHosting).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('publish-dialog')).toBeNull()
  })

  it('opens the options with hosting, and the running step while it runs', async () => {
    render(<PublishButton disabled={false} onOpenHosting={vi.fn()} />)
    fireEvent.click(pill())
    expect(
      (await screen.findByTestId('publish-dialog')).getAttribute('data-step'),
    ).toBe('opts')

    fireEvent.click(screen.getByTestId('publish-go'))
    expect(screen.getByTestId('publish-dialog').getAttribute('data-step')).toBe(
      'run',
    )
    fireEvent.click(screen.getByTestId('publish-hide'))
    expect(screen.queryByTestId('publish-dialog')).toBeNull()
    expect(pill().getAttribute('data-state')).toBe('running')

    fireEvent.click(pill())
    expect(
      (await screen.findByTestId('publish-dialog')).getAttribute('data-step'),
    ).toBe('run')
  })

  it('shows the check alone when done and opens Done with the link', async () => {
    render(<PublishButton disabled={false} onOpenHosting={vi.fn()} />)
    act(() => {
      publishStore.dispatch({ type: 'start' })
      publishStore.dispatch({
        type: 'done',
        summary: { uploaded: 1, bytes: 0, removed: 0, unchanged: 0 },
        bookUrl: 'https://books.example.com/books/a/',
        homeUrl: 'https://books.example.com/',
      })
    })

    expect(pill().getAttribute('data-state')).toBe('done')
    expect(pill().getAttribute('title')).toBe('Published')
    expect(pill().textContent).toBe('Publish')
    expect(pill().querySelectorAll('.site-job-pill__label')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('Published')
    fireEvent.click(pill())
    expect(
      (await screen.findByTestId('publish-dialog')).getAttribute('data-step'),
    ).toBe('done')
    expect(screen.getByTestId('publish-link').textContent).toBe(
      'https://books.example.com/books/a/',
    )
  })

  it('shows the warning until opened, then rests again', async () => {
    render(<PublishButton disabled={false} onOpenHosting={vi.fn()} />)
    act(() => {
      publishStore.dispatch({ type: 'start' })
      publishStore.dispatch({
        type: 'failed',
        failure: { code: 'key', message: '', sent: 0, total: 0 },
      })
    })
    expect(pill().getAttribute('data-state')).toBe('failed')
    expect(screen.getByRole('status').textContent).toBe("Publish didn't finish")
    expect(pill().querySelector('svg')).not.toBeNull()

    fireEvent.click(pill())

    expect(
      (await screen.findByTestId('publish-dialog')).getAttribute('data-step'),
    ).toBe('failed')
    expect(pill().getAttribute('data-state')).toBe('idle')
  })
})
