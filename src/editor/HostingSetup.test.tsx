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
