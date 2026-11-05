import { describe, expect, it, vi } from 'vitest'
import type { DerivativePreset } from '../plan'
import type { LabFixture } from './fixtures'
import { startLab, type LabPort } from './labPage'
import type { LabRequest, LabResponse, LabVariant } from './runLab'

const webp: DerivativePreset = {
  id: '1600-webp-q85',
  maxEdge: 1600,
  mimeType: 'image/webp',
  quality: 0.85,
}
const jpeg: DerivativePreset = {
  id: '1600-jpeg-q90',
  maxEdge: 1600,
  mimeType: 'image/jpeg',
  quality: 0.9,
}

function variant(fixture: LabFixture, preset: DerivativePreset): LabVariant {
  return {
    fixture,
    preset,
    width: 1600,
    height: 1200,
    byteLength: 2048,
    ssim: fixture === 'foliage' && preset === jpeg ? 0.96 : 0.98765,
    bandStep: 1.25,
    bytes: new ArrayBuffer(2048),
    mimeType: preset.mimeType,
  }
}

/** Worker double: answers each request asynchronously from `reply`. */
function fakePort(reply: (request: LabRequest) => LabResponse) {
  const posted: LabRequest[] = []
  const port: LabPort = {
    onmessage: null,
    postMessage(message) {
      posted.push(message)
      queueMicrotask(() => {
        port.onmessage?.(new MessageEvent('message', { data: reply(message) }))
      })
    },
  }
  return { port, posted }
}

function okReply({ fixture }: LabRequest): LabResponse {
  return {
    fixture,
    ok: true,
    variants: [variant(fixture, webp), variant(fixture, jpeg)],
  }
}

describe('startLab', () => {
  it('renders every fixture, then the picks and the markdown table', async () => {
    const root = document.createElement('main')
    const { port, posted } = fakePort(okReply)
    const objectUrl = vi.fn(
      (blob: Blob) => `blob:${blob.type}/${String(blob.size)}`,
    )

    await startLab(root, port, objectUrl)

    expect(posted).toEqual([
      { fixture: 'sky' },
      { fixture: 'shadows' },
      { fixture: 'foliage' },
    ])
    expect(root.dataset.labState).toBe('done')
    expect(
      [...root.querySelectorAll('section')].map((s) => [
        s.dataset.fixture,
        s.querySelector('h2')?.textContent,
      ]),
    ).toEqual([
      ['sky', 'sky'],
      ['shadows', 'shadows'],
      ['foliage', 'foliage'],
    ])
    const figures = root.querySelectorAll('[data-testid="lab-variant"]')
    expect(figures).toHaveLength(6)
    const first = figures[0] as HTMLElement
    expect(first.dataset.preset).toBe('1600-webp-q85')
    expect(first.closest('.lab-grid')).not.toBeNull()
    expect(first.querySelector('img')?.getAttribute('src')).toBe(
      'blob:image/webp/2048',
    )
    expect(first.querySelector('img')?.alt).toBe('sky 1600-webp-q85')
    expect(first.querySelector('figcaption')?.textContent).toBe(
      '1600-webp-q85 · 2.0 KB · SSIM 0.9877 · step 1.25 · pass',
    )
    expect(figures[5]?.querySelector('figcaption')?.textContent).toBe(
      '1600-jpeg-q90 · 2.0 KB · SSIM 0.9600 · step 1.25 · fail',
    )
    expect(root.querySelector('[data-testid="lab-status"]')?.textContent).toBe(
      '6 variants',
    )
    expect(
      [...root.querySelectorAll('[data-testid="lab-picks"] li')].map(
        (li) => li.textContent,
      ),
    ).toEqual([
      '1600 webp: q0.85 (6.0 KB over all fixtures)',
      '1600 jpeg: no candidate passes',
    ])
    const table = root.querySelector('[data-testid="lab-table"]')
    expect(table?.tagName).toBe('PRE')
    expect(table?.textContent.split('\n')).toHaveLength(8)
  })

  it('stops at a failed fixture with the error in the status line', async () => {
    const root = document.createElement('main')
    const { port, posted } = fakePort((request) =>
      request.fixture === 'shadows'
        ? { fixture: 'shadows', ok: false, error: 'encoder gone' }
        : okReply(request),
    )

    await startLab(root, port, () => 'blob:x')

    expect(posted).toHaveLength(2)
    expect(root.dataset.labState).toBe('error')
    expect(root.querySelector('[data-testid="lab-status"]')?.textContent).toBe(
      'shadows failed: encoder gone',
    )
    expect(root.querySelectorAll('section')).toHaveLength(1)
    expect(root.querySelector('[data-testid="lab-table"]')).toBeNull()
  })

  it('shows progress while a fixture encodes', () => {
    const root = document.createElement('main')
    const port: LabPort = { onmessage: null, postMessage: vi.fn() }

    void startLab(root, port, () => 'blob:x')

    expect(root.dataset.labState).toBe('running')
    expect(root.querySelector('[data-testid="lab-status"]')?.textContent).toBe(
      'Encoding sky…',
    )
  })
})
