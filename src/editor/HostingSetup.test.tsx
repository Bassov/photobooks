import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadHostingSummary } from '../publish/credentials'
import {
  ACCOUNT,
  cfError,
  createFakeCloudflare,
  dumpIndexedDb,
  SETUP_TOKEN,
} from '../publish/fakeCloudflare.test-helpers'
import { HostingSection } from './HostingSection'
import { SETUP_MESSAGES } from './hostingSetupModel'

const ROW = 'flex min-h-13 items-center gap-4 px-4 py-2'
const rule = () => <div data-testid="settings-rule" />
const HOST = 'books.basov.photo'
const STUDIO = 'b'.repeat(32)

let cf: ReturnType<typeof createFakeCloudflare>
let idb: IDBFactory

const byId = (testId: string) => screen.getByTestId(testId)
const input = (testId: string) => screen.getByTestId<HTMLInputElement>(testId)
const state = (testId: string) => byId(testId).dataset.state

function paste(token: string) {
  fireEvent.change(input('hosting-setup-token'), { target: { value: token } })
}

async function openSetup() {
  render(<HostingSection row={ROW} rule={rule} />)
  return screen.findByTestId('hosting-setup')
}

async function toStep2() {
  await openSetup()
  paste(`  ${SETUP_TOKEN}\n`)
  fireEvent.click(byId('hosting-setup-continue'))
  await screen.findByTestId('hosting-setup-host')
}

async function settled() {
  await waitFor(() => {
    expect(byId('hosting-setup').hasAttribute('aria-busy')).toBe(false)
  })
}

/** The setup token anywhere a page could keep it. */
async function expectNoTokenLeft() {
  expect(document.body.innerHTML).not.toContain(SETUP_TOKEN)
  expect(location.href).not.toContain(SETUP_TOKEN)
  expect(
    Object.keys(localStorage)
      .map((key) => `${key}=${localStorage.getItem(key) ?? ''}`)
      .join('\n'),
  ).not.toContain(SETUP_TOKEN)
  expect(await dumpIndexedDb(idb)).not.toContain(SETUP_TOKEN)
}

describe('HostingSetup', () => {
  beforeEach(() => {
    idb = new IDBFactory()
    vi.stubGlobal('indexedDB', idb)
    cf = createFakeCloudflare()
    vi.stubGlobal('fetch', vi.fn(cf.fetch))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens at step 1: one current step, Continue waits for a token', async () => {
    await openSetup()
    expect(state('hosting-marker-1')).toBe('current')
    expect(state('hosting-marker-2')).toBe('future')
    expect(state('hosting-marker-3')).toBe('future')
    expect(byId('hosting-step-1').getAttribute('aria-current')).toBe('step')
    expect(input('hosting-setup-token').type).toBe('password')
    expect(input('hosting-setup-token').autocomplete).toBe('off')
    fireEvent.click(byId('hosting-setup-continue'))
    expect(cf.calls).toHaveLength(0)
    paste('short')
    expect(byId('hosting-setup').textContent).toContain(SETUP_MESSAGES.token)
    fireEvent.click(byId('hosting-setup-continue'))
    expect(cf.calls).toHaveLength(0)
  })

  it('a rejected token stays at step 1 with the error', async () => {
    cf.setOverride((call) =>
      call.path === '/user/tokens/verify' ? cfError(401, 1000) : undefined,
    )
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    await screen.findByTestId('hosting-error')
    expect(state('hosting-marker-1')).toBe('current')
    expect(input('hosting-setup-token').value).toBe(SETUP_TOKEN)
  })

  it('Continue clears the token and shows the address with its bucket', async () => {
    await toStep2()
    expect(screen.queryByTestId('hosting-setup-token')).toBeNull()
    expect(state('hosting-marker-1')).toBe('done')
    expect(byId('hosting-step-1-summary').textContent).toBe('Aleksandr Basov')
    expect(byId('hosting-setup-host').textContent).toContain(HOST)
    expect(byId('hosting-setup-bucket').textContent).toContain(
      'pb-books-basov-photo',
    )
    expect(cf.calls.every((call) => call.authorization !== null)).toBe(true)
    await expectNoTokenLeft()
  })

  it('a bad subdomain blocks the run', async () => {
    await toStep2()
    fireEvent.change(input('hosting-setup-sub'), { target: { value: '-x' } })
    expect(byId('hosting-setup').textContent).toContain(
      SETUP_MESSAGES.subdomain,
    )
    const before = cf.calls.length
    fireEvent.click(byId('hosting-setup-run'))
    expect(cf.calls).toHaveLength(before)
  })

  it('R2 off: the box, then Check again moves on', async () => {
    cf.state.r2Off.add(ACCOUNT)
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    await waitFor(() => {
      expect(byId('hosting-setup-box').textContent).toContain(
        'R2 is off in this account.',
      )
    })
    cf.state.r2Off.delete(ACCOUNT)
    fireEvent.click(byId('hosting-setup-recheck'))
    await screen.findByTestId('hosting-setup-host')
  })

  it('no active zone: the box names the pending one', async () => {
    cf.state.zones[ACCOUNT] = [
      { id: 'z2', name: 'mybooks.org', status: 'pending' },
    ]
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    await screen.findByTestId('hosting-setup-pending')
    expect(byId('hosting-setup-pending').textContent).toContain('mybooks.org')
    expect(byId('hosting-setup-run').hasAttribute('disabled')).toBe(true)
  })

  it('happy path: six rows, then the connected card; no token kept', async () => {
    await toStep2()
    fireEvent.click(byId('hosting-setup-run'))
    await screen.findByTestId('hosting-connected')
    expect(byId('hosting-connected').textContent).toContain(
      'Set up automatically',
    )
    expect(screen.queryByTestId('hosting-token-left')).toBeNull()
    const summary = await loadHostingSummary()
    expect(summary?.origin).toBe('setup')
    expect(summary?.publicBaseUrl).toBe(`https://${HOST}`)
    expect(cf.state.tokens.size).toBe(1)
    await expectNoTokenLeft()
  })

  it('a DNS conflict fails row 3; Try again resumes there', async () => {
    cf.state.dnsTaken.add(HOST)
    await toStep2()
    fireEvent.click(byId('hosting-setup-run'))
    await waitFor(() => {
      expect(state('hosting-setup-row-3')).toBe('failed')
    })
    await settled()
    expect(state('hosting-setup-row-1')).toBe('done')
    expect(state('hosting-setup-row-4')).toBe('pending')
    expect(byId('hosting-setup-row-error').textContent).not.toBe('')
    cf.state.dnsTaken.delete(HOST)
    const before = cf.calls.length
    fireEvent.click(byId('hosting-setup-retry'))
    await screen.findByTestId('hosting-connected')
    const again = cf.requests().slice(before)
    expect(again.some((call) => call.startsWith('POST /accounts/'))).toBe(true)
    expect(again.some((call) => call.endsWith('/cors'))).toBe(false)
    expect(
      again.some((call) => /^POST \/accounts\/[^/]+\/r2\/buckets$/.test(call)),
    ).toBe(false)
    await expectNoTokenLeft()
  })

  it('Cancel setup returns to step 2 and drops the run', async () => {
    cf.state.dnsTaken.add(HOST)
    await toStep2()
    fireEvent.click(byId('hosting-setup-run'))
    await waitFor(() => {
      expect(state('hosting-setup-row-3')).toBe('failed')
    })
    await settled()
    fireEvent.click(byId('hosting-setup-cancel'))
    expect(state('hosting-marker-2')).toBe('current')
    expect(screen.queryByTestId('hosting-setup-progress')).toBeNull()
    expect(await loadHostingSummary()).toBeNull()
    await expectNoTokenLeft()
  })

  it('a token that cannot be deleted leaves the API Tokens line', async () => {
    cf.setOverride((call) =>
      call.method === 'DELETE' ? cfError(500) : undefined,
    )
    await toStep2()
    fireEvent.click(byId('hosting-setup-run'))
    await screen.findByTestId('hosting-token-left')
    expect((await loadHostingSummary())?.setupTokenLeft).toBe(true)
    await expectNoTokenLeft()
  })

  it('the manual link drops a typed token', async () => {
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-manual'))
    expect(input('hosting-setup-token').value).toBe('')
    fireEvent.click(byId('hosting-guided'))
    expect(state('hosting-marker-1')).toBe('current')
  })
})

/** Hold relay calls whose path matches until the returned release runs. */
function hold(match: (url: string) => boolean): () => void {
  const opened: (() => void)[] = []
  const gate = new Promise<void>((resolve) => {
    opened.push(resolve)
  })
  const release = () => {
    for (const resolve of opened) resolve()
  }
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    if (match(url.toString())) await gate
    return cf.fetch(url, init)
  })
  return release
}

const ringed = (testId: string) =>
  input(testId).parentElement?.className.includes('ring-[#a8403a]')
const red = (element: HTMLElement) =>
  (element.getAttribute('style') ?? '').includes('color')
function tokenLine(): HTMLElement {
  const line = byId('hosting-setup').querySelector<HTMLElement>(
    '#hosting-setup-token-line',
  )
  if (line === null) throw new Error('no token line')
  return line
}

describe('HostingSetup states', () => {
  beforeEach(() => {
    idb = new IDBFactory()
    vi.stubGlobal('indexedDB', idb)
    cf = createFakeCloudflare()
    vi.stubGlobal('fetch', vi.fn(cf.fetch))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('token field: quiet at rest, red when malformed, Enter continues', async () => {
    await openSetup()
    const token = input('hosting-setup-token')
    expect(token.getAttribute('aria-invalid')).toBeNull()
    expect(token.getAttribute('spellcheck')).toBe('false')
    expect(token.readOnly).toBe(false)
    expect(ringed('hosting-setup-token')).toBe(false)
    expect(tokenLine().textContent).toContain('Permissions:')
    expect(red(tokenLine())).toBe(false)
    expect(byId('hosting-setup').textContent).toContain(
      'Sent to Cloudflare through Photobooks. Never stored.',
    )
    expect(byId('hosting-setup').hasAttribute('aria-busy')).toBe(false)
    expect(byId('hosting-setup-continue').hasAttribute('disabled')).toBe(true)

    paste('nope')
    expect(token.getAttribute('aria-invalid')).toBe('true')
    expect(ringed('hosting-setup-token')).toBe(true)
    expect(red(tokenLine())).toBe(true)
    expect(byId('hosting-setup-continue').hasAttribute('disabled')).toBe(true)
    fireEvent.keyDown(token, { key: 'Enter' })
    expect(cf.calls).toHaveLength(0)

    paste(SETUP_TOKEN)
    expect(token.getAttribute('aria-invalid')).toBeNull()
    expect(ringed('hosting-setup-token')).toBe(false)
    expect(byId('hosting-setup-continue').hasAttribute('disabled')).toBe(false)
    fireEvent.keyDown(token, { key: 'a' })
    expect(cf.calls).toHaveLength(0)
    fireEvent.keyDown(token, { key: 'Enter' })
    await screen.findByTestId('hosting-setup-host')
  })

  it('Checking: busy card, read-only muted token, a second Continue is ignored', async () => {
    const release = hold((url) => url.endsWith('/verify'))
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    expect(byId('hosting-setup').getAttribute('aria-busy')).toBe('true')
    const token = input('hosting-setup-token')
    expect(token.readOnly).toBe(true)
    expect(token.className).toContain('text-muted-foreground')
    expect(byId('hosting-setup-continue').hasAttribute('disabled')).toBe(false)
    fireEvent.click(byId('hosting-setup-continue'))
    release()
    await screen.findByTestId('hosting-setup-host')
    expect(
      cf.requests().filter((call) => call.endsWith('/verify')),
    ).toHaveLength(1)
    expect(byId('hosting-setup').hasAttribute('aria-busy')).toBe(false)
  })

  it('only token failures ring the token; typing clears the failure', async () => {
    let status = 500
    cf.setOverride((call) =>
      call.path === '/user/tokens/verify' ? cfError(status, 1) : undefined,
    )
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    await screen.findByTestId('hosting-error')
    expect(input('hosting-setup-token').getAttribute('aria-invalid')).toBeNull()
    expect(ringed('hosting-setup-token')).toBe(false)
    expect(byId('hosting-setup').textContent).not.toContain('Never stored.')

    status = 401
    fireEvent.click(byId('hosting-setup-continue'))
    await waitFor(() => {
      expect(input('hosting-setup-token').getAttribute('aria-invalid')).toBe(
        'true',
      )
    })
    expect(ringed('hosting-setup-token')).toBe(true)
    paste(`${SETUP_TOKEN}x`)
    expect(screen.queryByTestId('hosting-error')).toBeNull()
    expect(ringed('hosting-setup-token')).toBe(false)
  })

  it('step 2: markers, address hints, zone choice, reuse, Change back to step 1', async () => {
    cf.state.zones[ACCOUNT] = [
      { id: 'z1', name: 'basov.photo', status: 'active' },
      { id: 'z3', name: 'second.photo', status: 'active' },
    ]
    cf.state.buckets[ACCOUNT] = ['pb-books-basov-photo']
    await toStep2()
    expect(['1', '2', '3'].map((n) => state(`hosting-marker-${n}`))).toEqual([
      'done',
      'current',
      'future',
    ])
    expect(byId('hosting-step-1').hasAttribute('aria-current')).toBe(false)
    expect(byId('hosting-step-2').getAttribute('aria-current')).toBe('step')
    expect(screen.queryByTestId('hosting-step-2-change')).toBeNull()
    expect(screen.queryByTestId('hosting-setup-account')).toBeNull()
    expect(screen.queryByTestId('hosting-setup-pending')).toBeNull()
    expect(
      byId('hosting-marker-1').querySelector('[data-icon="check"]'),
    ).not.toBeNull()
    expect(byId('hosting-marker-2').textContent).toBe('2')

    const host = byId('hosting-setup-host')
    expect(host.textContent).toBe(
      'Your site: https://books.basov.photo. Leave the first part empty to use basov.photo itself.',
    )
    expect(red(host)).toBe(false)
    expect(byId('hosting-setup-bucket').textContent).toBe(
      'Storage: existing R2 bucket pb-books-basov-photo (reused)',
    )

    fireEvent.change(input('hosting-setup-zone'), {
      target: { value: 'second.photo' },
    })
    expect(host.textContent).toContain('https://books.second.photo.')
    expect(byId('hosting-setup-bucket').textContent).toBe(
      'Storage: new R2 bucket pb-books-second-photo',
    )
    fireEvent.change(input('hosting-setup-sub'), { target: { value: ' ' } })
    expect(host.textContent).toContain('https://second.photo.')

    fireEvent.change(input('hosting-setup-sub'), { target: { value: 'a_b' } })
    expect(input('hosting-setup-sub').getAttribute('aria-invalid')).toBe('true')
    expect(ringed('hosting-setup-sub')).toBe(true)
    expect(red(host)).toBe(true)
    expect(byId('hosting-setup-run').hasAttribute('disabled')).toBe(true)
    fireEvent.keyDown(input('hosting-setup-sub'), { key: 'Enter' })
    expect(screen.queryByTestId('hosting-setup-progress')).toBeNull()
    fireEvent.change(input('hosting-setup-sub'), { target: { value: 'Ok' } })
    expect(input('hosting-setup-sub').value).toBe('ok')
    expect(input('hosting-setup-sub').getAttribute('aria-invalid')).toBeNull()
    expect(ringed('hosting-setup-sub')).toBe(false)

    fireEvent.click(byId('hosting-step-1-change'))
    expect(state('hosting-marker-1')).toBe('current')
    expect(input('hosting-setup-token').value).toBe('')
    expect(byId('hosting-setup-continue').hasAttribute('disabled')).toBe(true)
    expect(screen.queryByTestId('hosting-step-1-change')).toBeNull()
  })

  it('Enter in the subdomain runs setup; other keys do not', async () => {
    await toStep2()
    fireEvent.keyDown(input('hosting-setup-sub'), { key: 'x' })
    expect(screen.queryByTestId('hosting-setup-progress')).toBeNull()
    fireEvent.keyDown(input('hosting-setup-sub'), { key: 'Enter' })
    await screen.findByTestId('hosting-connected')
  })

  it('several accounts: the picker switches zones and Check again keeps it', async () => {
    cf.state.accounts.push({ id: STUDIO, name: 'Studio' })
    cf.state.zones[STUDIO] = []
    await toStep2()
    const picker = input('hosting-setup-account')
    expect(picker.value).toBe(ACCOUNT)
    fireEvent.change(picker, { target: { value: STUDIO } })
    expect(byId('hosting-setup-box').textContent).toContain(
      'This account has no active domain yet.',
    )
    expect(screen.queryByTestId('hosting-setup-pending')).toBeNull()
    expect(screen.queryByTestId('hosting-setup-bucket')).toBeNull()
    expect(byId('hosting-setup-run').hasAttribute('disabled')).toBe(true)
    cf.state.zones[STUDIO] = [
      { id: 'z9', name: 'studio.art', status: 'active' },
    ]
    fireEvent.click(byId('hosting-setup-recheck'))
    await waitFor(() => {
      expect(byId('hosting-setup-host').textContent).toContain(
        'https://books.studio.art.',
      )
    })
    expect(input('hosting-setup-account').value).toBe(STUDIO)
    expect(byId('hosting-step-1-summary').textContent).toBe('Studio')
  })

  it('a failed no-zone recheck shows the error in the box', async () => {
    cf.state.zones[ACCOUNT] = []
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    await screen.findByTestId('hosting-setup-box')
    cf.setOverride((call) =>
      call.path === '/accounts' ? cfError(500, 1) : undefined,
    )
    fireEvent.click(byId('hosting-setup-recheck'))
    await waitFor(() => {
      expect(
        byId('hosting-setup-box').querySelector(
          '[data-testid="hosting-error"]',
        ),
      ).not.toBeNull()
    })
  })

  it('a failed R2 recheck shows the error in the R2 box', async () => {
    cf.state.r2Off.add(ACCOUNT)
    await openSetup()
    paste(SETUP_TOKEN)
    fireEvent.click(byId('hosting-setup-continue'))
    await screen.findByTestId('hosting-setup-box')
    cf.setOverride((call) =>
      call.path === '/accounts' ? cfError(500, 1) : undefined,
    )
    fireEvent.click(byId('hosting-setup-recheck'))
    await waitFor(() => {
      expect(
        byId('hosting-setup-box').querySelector(
          '[data-testid="hosting-error"]',
        ),
      ).not.toBeNull()
    })
    expect(byId('hosting-setup-box').textContent).toContain('R2 is off')
  })

  it('running and failed rows: icons, colours, buttons and the step 2 Change', async () => {
    cf.state.dnsTaken.add(HOST)
    const release = hold((url) => url.endsWith('/cors'))
    await toStep2()
    fireEvent.click(byId('hosting-setup-run'))
    await waitFor(() => {
      expect(state('hosting-setup-row-2')).toBe('running')
    })
    expect(byId('hosting-setup').getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByTestId('hosting-manual')).toBeNull()
    expect(screen.queryByTestId('hosting-setup-retry')).toBeNull()
    expect(screen.queryByTestId('hosting-step-2-change')).toBeNull()
    expect(byId('hosting-setup').textContent).toContain(
      'Keep this page open. It takes about a minute.',
    )
    expect(
      byId('hosting-setup-row-1').querySelector('[data-icon="check"]'),
    ).not.toBeNull()
    expect(byId('hosting-setup-row-3').firstElementChild?.className).toContain(
      'text-muted-foreground',
    )
    expect(byId('hosting-setup-row-3-text').textContent).toBe(`Connect ${HOST}`)
    release()
    await waitFor(() => {
      expect(state('hosting-setup-row-3')).toBe('failed')
    })
    await settled()
    const failedRow = byId('hosting-setup-row-3')
      .firstElementChild as HTMLElement
    expect(red(failedRow)).toBe(true)
    expect(failedRow.querySelector('[data-icon="warning"]')).not.toBeNull()
    expect(
      red(byId('hosting-setup-row-1').firstElementChild as HTMLElement),
    ).toBe(false)
    expect(screen.getAllByTestId('hosting-setup-row-error')).toHaveLength(1)
    expect(byId('hosting-setup').textContent).toContain(
      'Done steps are kept. Try again goes on from the failed one.',
    )
    expect(byId('hosting-manual')).toBeTruthy()
    expect(state('hosting-marker-2')).toBe('done')
    expect(byId('hosting-step-2-summary').textContent).toBe(HOST)
    expect(screen.queryByTestId('hosting-step-1-change')).toBeNull()

    fireEvent.click(byId('hosting-step-2-change'))
    expect(state('hosting-marker-2')).toBe('current')
    expect(screen.queryByTestId('hosting-setup-progress')).toBeNull()
    cf.state.dnsTaken.delete(HOST)
    fireEvent.click(byId('hosting-setup-run'))
    await screen.findByTestId('hosting-connected')
  })
})
