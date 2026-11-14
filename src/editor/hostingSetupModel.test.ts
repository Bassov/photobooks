import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import type { Discovery, RowState, SetupRow } from '../publish/provision'
import {
  addressView,
  applyRowState,
  failedRow,
  PENDING_PROGRESS,
  SETUP_MESSAGES,
  setupRowTexts,
  setupTarget,
  setupTokenState,
  siteHost,
  subdomainError,
  tidySubdomain,
  type ProgressView,
} from './hostingSetupModel'

const DISCOVERY: Discovery = {
  ok: true,
  tokenId: 'tok-id',
  accounts: [
    { id: 'acc-1', name: 'Basov' },
    { id: 'acc-2', name: 'Studio' },
  ],
  zonesByAccount: {
    'acc-1': [
      { id: 'z1', name: 'basov.photo', status: 'active' },
      { id: 'z2', name: 'later.photo', status: 'pending' },
      { id: 'z3', name: 'second.photo', status: 'active' },
    ],
  },
  bucketsByAccount: { 'acc-1': ['pb-books-basov-photo'], 'acc-2': null },
  defaultAccountId: 'acc-1',
  r2On: true,
  bucketWriteGroupId: 'group',
}

const row = fc.constantFrom<SetupRow>(1, 2, 3, 4, 5, 6)
const rowState: fc.Arbitrary<RowState> = fc.oneof(
  fc.record({ row, state: fc.constantFrom('running', 'done', 'warning') }),
  fc.record({
    row,
    state: fc.constant('failed'),
    code: fc.constant('conflict'),
    message: fc.string(),
  }),
)

describe('setupTokenState', () => {
  it('is empty for blank input', () => {
    expect(setupTokenState('   ')).toBe('')
  })

  it('accepts a 40-character token with spaces around it', () => {
    expect(setupTokenState(`  ${'a'.repeat(40)}\n`)).toBe('ok')
  })

  it('rejects a short value and other characters', () => {
    expect(setupTokenState('a'.repeat(39))).toBe('bad')
    expect(setupTokenState(`${'a'.repeat(40)}!`)).toBe('bad')
    expect(setupTokenState('a'.repeat(201))).toBe('bad')
  })

  test.prop([fc.stringMatching(/^[A-Za-z0-9_-]{40,200}$/)])(
    'any token-shaped value is ok',
    (token) => {
      expect(setupTokenState(token)).toBe('ok')
    },
  )
})

describe('subdomain', () => {
  it('tidies case and spaces', () => {
    expect(tidySubdomain('  Books ')).toBe('books')
  })

  it('allows the apex and DNS labels', () => {
    expect(subdomainError('')).toBeUndefined()
    expect(subdomainError('books')).toBeUndefined()
    expect(subdomainError('my-books2')).toBeUndefined()
  })

  it('rejects edge hyphens, dots and long labels', () => {
    for (const bad of ['-books', 'books-', 'a.b', 'a_b', 'x'.repeat(64)]) {
      expect(subdomainError(bad)).toBe(SETUP_MESSAGES.subdomain)
    }
  })

  it('builds the host, the apex without a dot', () => {
    expect(siteHost('books', 'basov.photo')).toBe('books.basov.photo')
    expect(siteHost('', 'basov.photo')).toBe('basov.photo')
  })
})

describe('addressView', () => {
  it('splits active zones from pending names', () => {
    const view = addressView(DISCOVERY, 'acc-1')
    expect(view.active.map((zone) => zone.name)).toEqual([
      'basov.photo',
      'second.photo',
    ])
    expect(view.pending).toEqual(['later.photo'])
  })

  it('is empty for an account without zones', () => {
    expect(addressView(DISCOVERY, 'acc-2')).toEqual({ active: [], pending: [] })
  })
})

describe('setupTarget', () => {
  it('reuses an existing bucket of the account', () => {
    expect(setupTarget(DISCOVERY, 'acc-1', 'books', 'basov.photo')).toEqual({
      host: 'books.basov.photo',
      bucket: 'pb-books-basov-photo',
      reused: true,
    })
  })

  it('creates a new bucket otherwise (unknown bucket list too)', () => {
    expect(setupTarget(DISCOVERY, 'acc-1', '', 'basov.photo').reused).toBe(
      false,
    )
    expect(setupTarget(DISCOVERY, 'acc-2', 'books', 'basov.photo').reused).toBe(
      false,
    )
  })

  it('names the six rows with bucket and host', () => {
    const texts = setupRowTexts('pb-b', 'b.example')
    expect(texts).toHaveLength(6)
    expect(texts[0]).toBe('Create the bucket pb-b')
    expect(texts[2]).toBe('Connect b.example')
    expect(texts[5]).toBe('Delete the setup token')
  })
})

describe('applyRowState', () => {
  it('maps warning to warn and keeps the failure message', () => {
    const warned = applyRowState(PENDING_PROGRESS, {
      row: 1,
      state: 'warning',
    })
    expect(warned.rows[0]).toBe('warn')
    const failed = applyRowState(warned, {
      row: 3,
      state: 'failed',
      code: 'conflict',
      message: 'A record already exists.',
    })
    expect(failed).toEqual({
      rows: ['warn', 'pending', 'failed', 'pending', 'pending', 'pending'],
      message: 'A record already exists.',
    })
    expect(failedRow(failed)).toBe(3)
  })

  it('a running row clears the message and resets later rows', () => {
    const view: ProgressView = {
      rows: ['done', 'done', 'done', 'done', 'failed', 'pending'],
      message: 'Upload failed.',
    }
    expect(applyRowState(view, { row: 4, state: 'running' })).toEqual({
      rows: ['done', 'done', 'done', 'running', 'pending', 'pending'],
    })
  })

  it('has no failed row while pending', () => {
    expect(failedRow(PENDING_PROGRESS)).toBeUndefined()
  })

  test.prop([fc.array(rowState, { maxLength: 20 })])(
    'rows before the last running row never change on it',
    (states) => {
      let view = PENDING_PROGRESS
      for (const next of states) {
        const before = view.rows
        view = applyRowState(view, next)
        expect(view.rows).toHaveLength(6)
        expect(view.rows.slice(0, next.row - 1)).toEqual(
          before.slice(0, next.row - 1),
        )
        expect('message' in view).toBe(next.state === 'failed')
        if (next.state === 'failed') expect(failedRow(view)).toBeDefined()
      }
    },
  )
})
