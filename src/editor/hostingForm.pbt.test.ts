import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { validateCredentials } from '../publish/credentials'
import {
  EMPTY_HOSTING_INPUT,
  HOSTING_FIELDS,
  HOSTING_MESSAGES,
  hostingFieldError,
  normaliseSiteAddress,
  setHostingField,
  validateHostingForm,
  type HostingInput,
} from './hostingForm'

const PBT_RUNS = { numRuns: 200 }

const ACCOUNT = '0f3a9c0123456789abcdef0123456789'
const VALID: HostingInput = {
  accountId: ACCOUNT,
  bucket: 'my-books',
  accessKeyId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  secretAccessKey:
    'f00dfeedc0ffee11deadbeef22cafebabe3344556677889900aabbccddeeff01',
  publicBaseUrl: 'https://books.example.com',
}

const hex = (length: number) =>
  fc.stringMatching(new RegExp(`^[0-9a-fA-F]{${String(length)}}$`))
const bucket = fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
const space = fc.constantFrom('', ' ', '\t', '\n', '  \n ')
const host = fc
  .domain()
  .filter((name) => name !== 'r2.dev' && !name.endsWith('.r2.dev'))
const messages: readonly string[] = Object.values(HOSTING_MESSAGES)

describe('hostingFieldError examples', () => {
  it.each([
    ['accountId', 'xyz', HOSTING_MESSAGES.accountId],
    ['accountId', `${ACCOUNT}0`, HOSTING_MESSAGES.accountId],
    [
      'accountId',
      `https://${ACCOUNT}.eu.r2.cloudflarestorage.com`,
      HOSTING_MESSAGES.jurisdiction,
    ],
    [
      'accountId',
      `https://${ACCOUNT}.fedramp.r2.cloudflarestorage.com/b-1`,
      HOSTING_MESSAGES.jurisdiction,
    ],
    [
      'accountId',
      `http://${ACCOUNT}.r2.cloudflarestorage.com`,
      HOSTING_MESSAGES.accountId,
    ],
    [
      'accountId',
      `https://${ACCOUNT}.r2.cloudflarestorage.com/a/b`,
      HOSTING_MESSAGES.accountId,
    ],
    [
      'accountId',
      `https://${ACCOUNT}.r2.cloudflarestorage.com/?x`,
      HOSTING_MESSAGES.accountId,
    ],
    [
      'accountId',
      `https://${ACCOUNT}.r2.cloudflarestorage.com:8443`,
      HOSTING_MESSAGES.accountId,
    ],
    [
      'accountId',
      `https://u:p@${ACCOUNT}.r2.cloudflarestorage.com`,
      HOSTING_MESSAGES.accountId,
    ],
    ['bucket', 'My-Books', HOSTING_MESSAGES.bucket],
    ['bucket', 'ab', HOSTING_MESSAGES.bucket],
    ['bucket', '-ab', HOSTING_MESSAGES.bucket],
    ['accessKeyId', 'g'.repeat(32), HOSTING_MESSAGES.accessKeyId],
    ['secretAccessKey', 'a'.repeat(63), HOSTING_MESSAGES.secretAccessKey],
    ['publicBaseUrl', 'http://books.example.com', HOSTING_MESSAGES.http],
    ['publicBaseUrl', 'https://books.example.com/site', HOSTING_MESSAGES.path],
    ['publicBaseUrl', 'books.example.com/site', HOSTING_MESSAGES.path],
    ['publicBaseUrl', 'https://books.example.com/?a=1', HOSTING_MESSAGES.path],
    ['publicBaseUrl', 'https://books.example.com/#top', HOSTING_MESSAGES.path],
    ['publicBaseUrl', 'https://books.example.com?', HOSTING_MESSAGES.path],
    // PBT counterexample: URL#pathname drops dot segments.
    ['publicBaseUrl', 'a.aa/.', HOSTING_MESSAGES.path],
    [
      'publicBaseUrl',
      'https://books.example.com/site/..',
      HOSTING_MESSAGES.path,
    ],
    ['publicBaseUrl', 'books.example.com\\site', HOSTING_MESSAGES.path],
    [
      'accountId',
      `https://${ACCOUNT}.r2.cloudflarestorage.com/.`,
      HOSTING_MESSAGES.accountId,
    ],
    [
      'accountId',
      `https://${ACCOUNT}.r2.cloudflarestorage.com/b-1/..`,
      HOSTING_MESSAGES.accountId,
    ],
    ['publicBaseUrl', 'https://pub-1a2b.r2.dev', HOSTING_MESSAGES.r2dev],
    ['publicBaseUrl', 'r2.dev', HOSTING_MESSAGES.r2dev],
    ['publicBaseUrl', 'ftp://books.example.com', HOSTING_MESSAGES.siteAddress],
    ['publicBaseUrl', 'https://localhost', HOSTING_MESSAGES.siteAddress],
    ['publicBaseUrl', 'https://1.2.3.4', HOSTING_MESSAGES.siteAddress],
    [
      'publicBaseUrl',
      'https://books.example.com:8443',
      HOSTING_MESSAGES.siteAddress,
    ],
    [
      'publicBaseUrl',
      'https://me:pw@books.example.com',
      HOSTING_MESSAGES.siteAddress,
    ],
    ['publicBaseUrl', 'https://', HOSTING_MESSAGES.siteAddress],
    ['publicBaseUrl', 'books example', HOSTING_MESSAGES.siteAddress],
  ] as const)('%s %j → %s', (field, value, message) => {
    expect(hostingFieldError(field, value)).toBe(message)
  })

  it('accepts the valid sample and shows nothing for empty fields', () => {
    for (const field of HOSTING_FIELDS) {
      expect(hostingFieldError(field, VALID[field])).toBeUndefined()
      expect(hostingFieldError(field, '  ')).toBeUndefined()
    }
    expect(
      hostingFieldError('publicBaseUrl', 'Books.Example.com/'),
    ).toBeUndefined()
  })
})

describe('setHostingField examples', () => {
  it('fills an empty bucket from the endpoint URL and keeps a typed one', () => {
    const url = ` https://${ACCOUNT.toUpperCase()}.R2.cloudflarestorage.com/my-books/ `

    expect(setHostingField(EMPTY_HOSTING_INPUT, 'accountId', url)).toEqual({
      ...EMPTY_HOSTING_INPUT,
      accountId: ACCOUNT,
      bucket: 'my-books',
    })
    expect(
      setHostingField(
        { ...EMPTY_HOSTING_INPUT, bucket: 'other' },
        'accountId',
        `https://${ACCOUNT}.r2.cloudflarestorage.com/my-books`,
      ).bucket,
    ).toBe('other')
    expect(
      setHostingField(
        EMPTY_HOSTING_INPUT,
        'accountId',
        `https://${ACCOUNT}.r2.cloudflarestorage.com`,
      ),
    ).toEqual({ ...EMPTY_HOSTING_INPUT, accountId: ACCOUNT })
    expect(
      setHostingField(
        EMPTY_HOSTING_INPUT,
        'accountId',
        `https://${ACCOUNT}.r2.cloudflarestorage.com/./my-books`,
      ).accountId,
    ).toBe(`https://${ACCOUNT}.r2.cloudflarestorage.com/./my-books`)
  })

  it('leaves an unparsed account value trimmed only', () => {
    const jurisdiction = `https://${ACCOUNT}.eu.r2.cloudflarestorage.com`

    expect(
      setHostingField(EMPTY_HOSTING_INPUT, 'accountId', ` ${jurisdiction}`)
        .accountId,
    ).toBe(jurisdiction)
    expect(
      setHostingField(EMPTY_HOSTING_INPUT, 'accessKeyId', ' ABC ').accessKeyId,
    ).toBe('ABC')
  })

  it('normalises the site address on blur', () => {
    expect(normaliseSiteAddress(' Books.Example.COM/ ')).toBe(
      'https://books.example.com',
    )
    expect(normaliseSiteAddress('http://books.example.com')).toBe(
      'http://books.example.com',
    )
    expect(normaliseSiteAddress('books.example.com/a')).toBe(
      'https://books.example.com/a',
    )
    expect(normaliseSiteAddress('   ')).toBe('')
  })
})

describe('validateHostingForm examples', () => {
  it('normalises a valid form into storable credentials', () => {
    const result = validateHostingForm({
      ...VALID,
      accountId: `https://${ACCOUNT}.r2.cloudflarestorage.com/my-books`,
      bucket: '',
      publicBaseUrl: 'BOOKS.example.com/',
    })

    expect(result).toEqual({
      ok: true,
      value: { ...VALID, publicBaseUrl: 'https://books.example.com' },
    })
  })

  it('marks empty fields Required and invalid ones with their message', () => {
    expect(
      validateHostingForm({ ...EMPTY_HOSTING_INPUT, bucket: 'B' }),
    ).toEqual({
      ok: false,
      errors: {
        accountId: 'Required',
        bucket: HOSTING_MESSAGES.bucket,
        accessKeyId: 'Required',
        secretAccessKey: 'Required',
        publicBaseUrl: 'Required',
      },
    })
  })
})

describe('hosting form (PBT)', () => {
  test.prop([hex(32), space, space], PBT_RUNS)(
    'any-case 32 hex account id, padded, becomes lowercase and valid',
    (id, before, after) => {
      const next = setHostingField(
        EMPTY_HOSTING_INPUT,
        'accountId',
        `${before}${id}${after}`,
      )
      expect(next.accountId).toBe(id.toLowerCase())
      expect(hostingFieldError('accountId', `${before}${id}${after}`)).toBe(
        undefined,
      )
    },
  )

  test.prop([hex(32), bucket, fc.boolean()], PBT_RUNS)(
    'an endpoint URL gives its id and fills an empty bucket',
    (id, name, slash) => {
      const url = `https://${id}.r2.cloudflarestorage.com/${name}${slash ? '/' : ''}`
      expect(hostingFieldError('accountId', url)).toBeUndefined()
      expect(setHostingField(EMPTY_HOSTING_INPUT, 'accountId', url)).toEqual({
        ...EMPTY_HOSTING_INPUT,
        accountId: id.toLowerCase(),
        bucket: name,
      })
    },
  )

  test.prop(
    [hex(32), fc.constantFrom('eu', 'fedramp', 'EU'), bucket],
    PBT_RUNS,
  )('jurisdiction endpoints are refused', (id, jurisdiction, name) => {
    expect(
      hostingFieldError(
        'accountId',
        `https://${id}.${jurisdiction}.r2.cloudflarestorage.com/${name}`,
      ),
    ).toBe(HOSTING_MESSAGES.jurisdiction)
  })

  test.prop([host, fc.boolean(), fc.boolean(), fc.boolean()], PBT_RUNS)(
    'a custom domain normalises to https://<lowercase host>',
    (name, scheme, slash, upper) => {
      const typed = `${scheme ? 'https://' : ''}${upper ? name.toUpperCase() : name}${slash ? '/' : ''}`
      expect(hostingFieldError('publicBaseUrl', typed)).toBeUndefined()
      expect(normaliseSiteAddress(typed)).toBe(`https://${name}`)
    },
  )

  test.prop(
    [host, fc.webSegment().filter((segment) => segment !== '')],
    PBT_RUNS,
  )('http, a path and r2.dev each get their own message', (name, segment) => {
    expect(hostingFieldError('publicBaseUrl', `http://${name}`)).toBe(
      HOSTING_MESSAGES.http,
    )
    expect(hostingFieldError('publicBaseUrl', `${name}/${segment}`)).toBe(
      HOSTING_MESSAGES.path,
    )
    expect(
      hostingFieldError(
        'publicBaseUrl',
        `https://${name.split('.')[0] ?? ''}.r2.dev`,
      ),
    ).toBe(HOSTING_MESSAGES.r2dev)
  })

  test.prop([fc.constantFrom(...HOSTING_FIELDS), fc.string()], PBT_RUNS)(
    'an error is always a fixed message, never the value',
    (field, value) => {
      const error = hostingFieldError(field, value)
      if (error !== undefined) expect(messages).toContain(error)
    },
  )

  test.prop(
    [
      fc.record({
        accountId: fc.oneof(hex(32), fc.string()),
        bucket: fc.oneof(bucket, fc.string()),
        accessKeyId: fc.oneof(hex(32), fc.string()),
        secretAccessKey: fc.oneof(hex(64), fc.string()),
        publicBaseUrl: fc.oneof(host, fc.string()),
      }),
      space,
    ],
    PBT_RUNS,
  )(
    'ok exactly when every field is filled and valid; ok values store',
    (input, pad) => {
      const padded = Object.fromEntries(
        HOSTING_FIELDS.map((field) => [field, `${pad}${input[field]}${pad}`]),
      ) as unknown as HostingInput
      const result = validateHostingForm(padded)
      const fieldsOk = HOSTING_FIELDS.every(
        (field) =>
          input[field].trim() !== '' &&
          hostingFieldError(field, input[field]) === undefined,
      )
      expect(result.ok).toBe(fieldsOk)
      expect(validateHostingForm(input)).toEqual(result)
      if (result.ok) expect(validateCredentials(result.value).ok).toBe(true)
    },
  )
})
