import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCredentialStore,
  loadHostingSummary,
  type R2Credentials,
} from '../publish/credentials'
import { HostingSection } from './HostingSection'

const ROW = 'flex min-h-13 items-center gap-4 px-4 py-2'
const rule = () => <div data-testid="settings-rule" />

const ACCOUNT = '0f3a9c'.padEnd(32, 'b')
const KEY = 'a'.repeat(28) + '9f2c'
const SECRET = 'c0ffee'.repeat(10) + 'beef'
const STORED: R2Credentials = {
  accountId: ACCOUNT,
  bucket: 'aleksandr-books',
  accessKeyId: KEY,
  secretAccessKey: SECRET,
  publicBaseUrl: 'https://books.basov.photo',
}

const s3Error = (status: number, code: string) =>
  new Response(`<?xml version="1.0"?><Error><Code>${code}</Code></Error>`, {
    status,
  })

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

function answer(...responses: (Response | Error)[]) {
  fetchMock.mockImplementation(() => {
    const next = responses.shift() ?? new Response(null, { status: 200 })
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
}

const input = (testId: string) => screen.getByTestId<HTMLInputElement>(testId)
/** The field box that carries the ring. */
function box(testId: string): HTMLElement {
  const parent = input(testId).parentElement
  if (parent === null) throw new Error(`${testId} has no box`)
  return parent
}

/** Not inside the hidden mode. */
function shown(testId: string): boolean {
  return screen.getByTestId(testId).closest('[hidden]') === null
}

function type(testId: string, value: string) {
  fireEvent.change(input(testId), { target: { value } })
}

function fillValid() {
  type('hosting-account', ACCOUNT.toUpperCase())
  type('hosting-bucket', 'my-books')
  type('hosting-key', KEY)
  type('hosting-secret', `  ${SECRET} `)
  type('hosting-url', 'Books.Example.com')
  fireEvent.blur(input('hosting-url'))
}

/** Not connected opens the guided setup; these tests switch to the manual form. */
async function renderSection() {
  render(<HostingSection row={ROW} rule={rule} />)
  const shown = await screen.findByTestId(/^hosting-(setup|connected)$/)
  if (shown.dataset.testid === 'hosting-connected') return shown
  fireEvent.click(screen.getByTestId('hosting-manual'))
  return screen.getByTestId('hosting-form')
}

async function seedConnected(status = { checkedAtMs: Date.now(), ok: true }) {
  const store = createCredentialStore()
  await store.save(STORED)
  await store.saveStatus(status as { checkedAtMs: number; ok: true })
}

describe('HostingSection', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    fetchMock = vi.fn<typeof fetch>()
    answer()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('empty form: Spec labels, hints and attrs, Connect disabled', async () => {
    await renderSection()
    expect(screen.getByLabelText('Account ID')).toBe(input('hosting-account'))
    expect(input('hosting-account').placeholder).toBe(
      'e.g. 0f3a9c…  (32 characters)',
    )
    for (const id of [
      'hosting-account',
      'hosting-bucket',
      'hosting-key',
      'hosting-secret',
      'hosting-url',
    ]) {
      const el = input(id)
      expect(el.getAttribute('autocomplete')).toBe('off')
      expect(el.getAttribute('spellcheck')).toBe('false')
      expect(el.getAttribute('autocapitalize')).toBe('off')
      expect(el.hasAttribute('name')).toBe(false)
      expect(el.getAttribute('aria-invalid')).toBeNull()
    }
    expect(input('hosting-secret').type).toBe('password')
    expect(input('hosting-url').getAttribute('inputmode')).toBe('url')
    expect(screen.queryByRole('form')).toBeNull()
    expect(
      document.getElementById(
        input('hosting-secret').getAttribute('aria-describedby') ?? '',
      )?.textContent,
    ).toBe('Shown once by Cloudflare. Photobooks never shows it again.')
    expect(
      screen.getByTestId('hosting-connect').hasAttribute('data-disabled'),
    ).toBe(true)
    expect(screen.getByTestId('hosting-form').textContent).toContain(
      'Stored only on this computer. Sent only to Cloudflare.',
    )
    expect(
      screen.getByTestId('hosting-help').querySelectorAll('li'),
    ).toHaveLength(5)
    expect(screen.getByTestId('hosting-cors-json').textContent).toContain(
      `"AllowedOrigins": ["${location.origin}"]`,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates as you type and never echoes the secret', async () => {
    await renderSection()
    type('hosting-bucket', 'A')
    type('hosting-secret', 'xyz-not-hex')
    type('hosting-url', 'http://books.example.com')
    expect(input('hosting-bucket').getAttribute('aria-invalid')).toBe('true')
    expect(box('hosting-bucket').className).toContain('ring-[#a8403a]')
    expect(
      document.getElementById(
        input('hosting-bucket').getAttribute('aria-describedby') ?? '',
      )?.textContent,
    ).toBe('Bucket names are 3–63 characters: a–z, 0–9 and hyphens.')
    expect(screen.getByTestId('hosting-form').textContent).toContain(
      'The secret is 64 characters, 0–9 and a–f.',
    )
    expect(screen.getByTestId('hosting-form').textContent).toContain(
      'Use https://.',
    )
    expect(document.body.innerHTML).not.toContain('xyz-not-hex')
    type('hosting-bucket', '')
    expect(input('hosting-bucket').getAttribute('aria-invalid')).toBeNull()
  })

  it('reads an endpoint URL as the account id and fills an empty bucket', async () => {
    await renderSection()
    type(
      'hosting-account',
      `https://${ACCOUNT}.r2.cloudflarestorage.com/from-url`,
    )
    expect(input('hosting-bucket').value).toBe('')
    fireEvent.blur(input('hosting-account'))
    expect(input('hosting-account').value).toBe(ACCOUNT)
    expect(input('hosting-bucket').value).toBe('from-url')
    fireEvent.input(input('hosting-account'), {
      target: { value: `https://${ACCOUNT}.eu.r2.cloudflarestorage.com` },
      inputType: 'insertFromPaste',
    })
    expect(screen.getByTestId('hosting-form').textContent).toContain(
      "Buckets with a jurisdiction (EU, FedRAMP) aren't supported yet.",
    )
  })

  it('Connect checks, saves and shows the connected card without the secret', async () => {
    await renderSection()
    fillValid()
    expect(input('hosting-url').value).toBe('https://books.example.com')
    expect(
      screen.getByTestId('hosting-connect').hasAttribute('data-disabled'),
    ).toBe(false)
    fireEvent.click(screen.getByTestId('hosting-connect'))
    await screen.findByTestId('hosting-connected')
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
      'PUT',
      'HEAD',
      'DELETE',
    ])
    expect(screen.getByTestId('hosting-stored-key').textContent).toBe('…9f2c')
    expect(screen.getByTestId('hosting-stored-account').textContent).toBe(
      ACCOUNT,
    )
    expect(screen.getByTestId('hosting-stored-secret').textContent).toBe(
      '••••••••••••',
    )
    expect(
      screen.getByTestId('hosting-stored-secret').getAttribute('aria-label'),
    ).toBe('Stored, hidden')
    expect(screen.getByTestId('hosting-checked').textContent).toMatch(
      /^Checked today at \d\d:\d\d$/,
    )
    expect(screen.getByTestId('hosting-badge').textContent).toBe('Connected')
    const site = screen.getByTestId('hosting-site')
    expect(site.getAttribute('href')).toBe('https://books.example.com')
    expect(site.getAttribute('target')).toBe('_blank')
    expect(site.getAttribute('rel')).toBe('noopener noreferrer')
    expect(document.documentElement.outerHTML).not.toContain(SECRET)
    expect(document.documentElement.outerHTML).not.toContain(KEY)
    expect(screen.queryByTestId('hosting-help')).toBeNull()
    expect((await loadHostingSummary())?.bucket).toBe('my-books')
  })

  it('Enter in a field connects once valid; Checking keeps inputs read-only', async () => {
    let release: (value: Response) => void = () => undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    await renderSection()
    fireEvent.keyDown(input('hosting-bucket'), { key: 'Enter' })
    expect(fetchMock).not.toHaveBeenCalled()
    fillValid()
    fireEvent.keyDown(input('hosting-bucket'), { key: 'Enter' })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId('hosting-form').getAttribute('aria-busy')).toBe(
      'true',
    )
    expect(input('hosting-key').readOnly).toBe(true)
    expect(input('hosting-key').disabled).toBe(false)
    expect(screen.getByTestId('hosting-connect').textContent).toContain(
      'Checking…',
    )
    fireEvent.keyDown(input('hosting-bucket'), { key: 'Enter' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      release(new Response(null, { status: 200 }))
      await Promise.resolve()
    })
    await screen.findByTestId('hosting-connected')
  })

  it('a rejected key rings key and secret, stores nothing', async () => {
    answer(s3Error(403, 'InvalidAccessKeyId'))
    await renderSection()
    fillValid()
    fireEvent.click(screen.getByTestId('hosting-connect'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      "Cloudflare doesn't recognise this key. Check the access key ID and secret.",
    )
    expect(box('hosting-key').className).toContain('ring-[#a8403a]')
    expect(box('hosting-secret').className).toContain('ring-[#a8403a]')
    expect(box('hosting-bucket').className).not.toContain('ring-[#a8403a]')
    expect(input('hosting-key').readOnly).toBe(false)
    expect(await loadHostingSummary()).toBeNull()
  })

  it('a CORS failure marks help step 3', async () => {
    answer(new TypeError('Failed to fetch'))
    await renderSection()
    expect(
      screen.getByTestId('hosting-help-step-3').hasAttribute('data-marked'),
    ).toBe(false)
    fillValid()
    fireEvent.click(screen.getByTestId('hosting-connect'))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Add the CORS policy from step 3',
    )
    expect(
      screen.getByTestId('hosting-help-step-3').hasAttribute('data-marked'),
    ).toBe(true)
  })

  it('a storage failure after a passing check is reported in the footer', async () => {
    await renderSection()
    fillValid()
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('blocked')
      },
    })
    fireEvent.click(screen.getByTestId('hosting-connect'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Photobooks couldn't store the token on this computer. Try again.",
    )
  })

  it('copies the CORS policy and shows Copied for 2 s', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await renderSection()
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByTestId('hosting-cors-copy'))
      await act(async () => {
        await Promise.resolve()
      })
      expect(writeText).toHaveBeenCalledWith(
        screen.getByTestId('hosting-cors-json').textContent,
      )
      expect(screen.getByText('Copied').className).not.toContain('invisible')
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.getByText('Copied').className).toContain('invisible')
    } finally {
      vi.useRealTimers()
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('connected on open: no automatic check; Check again stores a failure', async () => {
    await seedConnected({
      checkedAtMs: new Date(2025, 0, 2, 22, 40).getTime(),
      ok: true,
    })
    await renderSection()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('hosting-checked').textContent).toBe(
      'Checked 2 Jan 2025 at 22:40',
    )
    answer(s3Error(403, 'SignatureDoesNotMatch'))
    fireEvent.click(screen.getByTestId('hosting-recheck'))
    await waitFor(() => {
      expect(screen.getByTestId('hosting-badge').textContent).toBe(
        "Can't connect",
      )
    })
    expect(screen.getByTestId('hosting-checked').textContent).toMatch(
      /^Last check failed today at/,
    )
    expect(screen.getByRole('alert').textContent).toBe(
      "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
    )
    expect((await loadHostingSummary())?.status).toMatchObject({
      ok: false,
      code: 'key',
    })
  })

  it('Replace prefills account, bucket and site; Cancel changes nothing', async () => {
    await seedConnected()
    await renderSection()
    fireEvent.click(screen.getByTestId('hosting-replace'))
    await screen.findByTestId('hosting-form')
    expect(screen.queryByTestId('hosting-guided')).toBeNull()
    expect(input('hosting-account').value).toBe(ACCOUNT)
    expect(input('hosting-bucket').value).toBe('aleksandr-books')
    expect(input('hosting-url').value).toBe('https://books.basov.photo')
    expect(input('hosting-key').value).toBe('')
    expect(input('hosting-secret').value).toBe('')
    await waitFor(() => {
      expect(document.activeElement).toBe(input('hosting-key'))
    })
    type('hosting-bucket', 'other-bucket')
    fireEvent.click(screen.getByTestId('hosting-cancel'))
    await screen.findByTestId('hosting-connected')
    expect(screen.getByTestId('hosting-stored-bucket').textContent).toBe(
      'aleksandr-books',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Replace → Connect replaces the stored record', async () => {
    await seedConnected()
    await renderSection()
    fireEvent.click(screen.getByTestId('hosting-replace'))
    await screen.findByTestId('hosting-form')
    type('hosting-key', 'b'.repeat(28) + '1234')
    type('hosting-secret', SECRET)
    fireEvent.click(screen.getByTestId('hosting-connect'))
    await screen.findByTestId('hosting-connected')
    expect(screen.getByTestId('hosting-stored-key').textContent).toBe('…1234')
  })

  it('Forget confirms, deletes everything and shows the empty form', async () => {
    await seedConnected()
    await renderSection()
    fireEvent.click(screen.getByTestId('hosting-forget'))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('Forget the hosting token?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
    expect(screen.getByTestId('hosting-connected')).toBeTruthy()
    fireEvent.click(screen.getByTestId('hosting-forget'))
    fireEvent.click(await screen.findByRole('button', { name: 'Forget token' }))
    await screen.findByTestId('hosting-form')
    expect(shown('hosting-form')).toBe(true)
    expect(shown('hosting-setup')).toBe(false)
    expect(input('hosting-account').value).toBe('')
    await waitFor(() => {
      expect(document.activeElement).toBe(input('hosting-account'))
    })
    expect(await loadHostingSummary()).toBeNull()
    expect(await createCredentialStore().loadStatus()).toBeNull()
  })

  it('Forget of a setup-made record returns to the setup with the token focused', async () => {
    await createCredentialStore().save(STORED, {
      origin: 'setup',
      provisionedAtMs: Date.now(),
    })
    await renderSection()
    expect(screen.getByTestId('hosting-checked').textContent).toContain(
      'Set up automatically',
    )
    expect(screen.getByTestId('hosting-badge').textContent).toBe('Connected')
    expect(screen.getByTestId('hosting-site-new').textContent).toBe(
      'New address: it can take a few minutes to start working.',
    )
    fireEvent.click(screen.getByTestId('hosting-forget'))
    fireEvent.click(await screen.findByRole('button', { name: 'Forget token' }))
    await screen.findByTestId('hosting-setup')
    expect(shown('hosting-setup')).toBe(true)
    await waitFor(() => {
      expect(document.activeElement).toBe(input('hosting-setup-token'))
    })
    expect(await loadHostingSummary()).toBeNull()
  })

  it('a left-over setup token shows the API Tokens line', async () => {
    await createCredentialStore().save(STORED, {
      origin: 'setup',
      provisionedAtMs: Date.now(),
      setupTokenLeft: true,
    })
    await renderSection()
    expect(screen.getByTestId('hosting-token-left').textContent).toContain(
      'API Tokens',
    )
  })

  it('an older setup record and a manual one show no new-address hint', async () => {
    await createCredentialStore().save(STORED, {
      origin: 'setup',
      provisionedAtMs: Date.now() - 20 * 60_000,
    })
    await renderSection()
    expect(screen.getByTestId('hosting-checked').textContent).toContain(
      'Set up automatically',
    )
    expect(screen.queryByTestId('hosting-site-new')).toBeNull()
    cleanup()
    await seedConnected()
    await renderSection()
    expect(screen.getByTestId('hosting-checked').textContent).toContain(
      'Checked',
    )
    expect(screen.queryByTestId('hosting-site-new')).toBeNull()
  })

  it('leaving the form for setup drops the secret: Connect waits for it again', async () => {
    await renderSection()
    fillValid()
    expect(screen.getByTestId('hosting-connect').hasAttribute('disabled')).toBe(
      false,
    )
    fireEvent.click(screen.getByTestId('hosting-guided'))
    fireEvent.click(screen.getByTestId('hosting-manual'))
    expect(input('hosting-account').value).toBe(ACCOUNT.toUpperCase())
    expect(screen.getByTestId('hosting-connect').hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('the mode links switch and drop the typed secret', async () => {
    await renderSection()
    type('hosting-secret', SECRET)
    fireEvent.click(screen.getByTestId('hosting-guided'))
    expect(shown('hosting-setup')).toBe(true)
    expect(shown('hosting-form')).toBe(false)
    expect(input('hosting-secret').value).toBe('')
    fireEvent.click(screen.getByTestId('hosting-manual'))
    expect(shown('hosting-form')).toBe(true)
    expect(shown('hosting-setup')).toBe(false)
  })

  it('rest form: intro, rules, muted hints, Connect label, no Cancel, no focus', async () => {
    await renderSection()
    expect(screen.getByTestId('settings-hosting-intro').textContent).toBe(
      'Publish puts your books on your own site, in your own Cloudflare account. Set it up once: Photobooks keeps only a key for its own bucket, on this computer.',
    )
    // 4 between the 5 fields + 1 above the footer.
    expect(
      within(screen.getByTestId('hosting-form')).getAllByTestId(
        'settings-rule',
      ),
    ).toHaveLength(5)
    const form = screen.getByTestId('hosting-form')
    expect(form.hasAttribute('aria-busy')).toBe(false)
    expect(screen.getByText('Connect').className).not.toContain('invisible')
    expect(within(form).getByText('Checking…').className).toContain('invisible')
    expect(input('hosting-key').className.split(' ')).not.toContain(
      'text-muted-foreground',
    )
    const hint = document.getElementById('hosting-account-line')
    expect(hint?.className).toContain('text-muted-foreground')
    expect(hint?.getAttribute('style')).toBeNull()
    expect(input('hosting-bucket').hasAttribute('aria-describedby')).toBe(false)
    expect(input('hosting-bucket').hasAttribute('inputmode')).toBe(false)
    expect(screen.queryByTestId('hosting-cancel')).toBeNull()
    expect(
      screen
        .getAllByRole('listitem')
        .map((li) => li.querySelector('span')?.textContent),
    ).toEqual(['1', '2', '3', '4', '5'])
    for (const li of screen.getAllByRole('listitem')) {
      expect(li.getAttribute('style')).toBeNull()
    }
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    expect(document.activeElement).toBe(document.body)
  })

  it('error lines and alerts paint in the error colour', async () => {
    answer(s3Error(403, 'InvalidAccessKeyId'))
    await renderSection()
    type('hosting-bucket', 'A')
    const line = document.getElementById('hosting-bucket-line')
    expect(line?.style.color).toBe('#a8403a')
    expect(line?.className).not.toContain('text-muted-foreground')
    fillValid()
    fireEvent.click(screen.getByTestId('hosting-connect'))
    expect((await screen.findByRole('alert')).style.color).toBe('#a8403a')
  })

  it('Connect stays disabled until every field and the secret are valid', async () => {
    await renderSection()
    const disabled = () =>
      screen.getByTestId('hosting-connect').hasAttribute('data-disabled')
    fillValid()
    expect(disabled()).toBe(false)
    type('hosting-bucket', 'A')
    expect(disabled()).toBe(true)
    type('hosting-bucket', 'my-books')
    type('hosting-key', '')
    expect(disabled()).toBe(true)
    type('hosting-key', KEY)
    type('hosting-secret', 'abc')
    expect(disabled()).toBe(true)
    type('hosting-secret', '')
    expect(disabled()).toBe(true)
    type('hosting-secret', SECRET)
    expect(disabled()).toBe(false)
    fireEvent.keyDown(input('hosting-key'), { key: 'a' })
    fireEvent.keyDown(screen.getByTestId('hosting-form'), { key: 'Enter' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trims a typed account id and the secret in place', async () => {
    await renderSection()
    type('hosting-account', `  ${ACCOUNT} `)
    expect(input('hosting-account').value).toBe(ACCOUNT)
    type('hosting-secret', `  ${SECRET} `)
    expect(input('hosting-secret').value).toBe(SECRET)
    type('hosting-url', 'books.example.com')
    fireEvent.blur(input('hosting-bucket'))
    expect(input('hosting-url').value).toBe('books.example.com')
  })

  it('Checking mutes the inputs and swaps the Connect label', async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined))
    await renderSection()
    fillValid()
    fireEvent.click(screen.getByTestId('hosting-connect'))
    await waitFor(() => {
      expect(screen.getByText('Connect').className).toContain('invisible')
    })
    expect(
      within(screen.getByTestId('hosting-form')).getByText('Checking…')
        .className,
    ).not.toContain('invisible')
    expect(input('hosting-key').className.split(' ')).toContain(
      'text-muted-foreground',
    )
  })

  it('a failed summary load shows the empty form', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('blocked')
      },
    })
    await renderSection()
    expect(screen.getByTestId('hosting-form')).toBeTruthy()
    expect(input('hosting-account').value).toBe('')
  })

  it('a stored token without a status shows no badge, date or alert', async () => {
    await createCredentialStore().save(STORED)
    await renderSection()
    expect(screen.queryByTestId('hosting-badge')).toBeNull()
    expect(screen.queryByTestId('hosting-checked')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('hosting-site').textContent).toBe(
      'books.basov.photo',
    )
  })

  it('Check again is busy once and locks Replace', async () => {
    await seedConnected()
    let release: (value: Response) => void = () => undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    await renderSection()
    const card = screen.getByTestId('hosting-connected')
    expect(card.hasAttribute('aria-busy')).toBe(false)
    fireEvent.click(screen.getByTestId('hosting-recheck'))
    await waitFor(() => {
      expect(card.getAttribute('aria-busy')).toBe('true')
    })
    expect(screen.getByText('Check again').className).toContain('invisible')
    expect(
      screen.getByTestId('hosting-replace').hasAttribute('data-disabled'),
    ).toBe(true)
    fireEvent.click(screen.getByTestId('hosting-recheck'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    await act(async () => {
      release(new Response(null, { status: 200 }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(card.hasAttribute('aria-busy')).toBe(false)
    })
    expect(screen.getByText('Check again').className).not.toContain('invisible')
    // One check = PUT, HEAD, DELETE; a second click while busy adds nothing.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('Copy outside a secure context still confirms', async () => {
    await renderSection()
    fireEvent.click(screen.getByTestId('hosting-cors-copy'))
    await waitFor(() => {
      expect(screen.getByText('Copied').className).not.toContain('invisible')
    })
    expect(screen.getByText('Copy').className).toContain('invisible')
  })
})
