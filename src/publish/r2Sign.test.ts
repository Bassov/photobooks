import { describe, expect, it } from 'vitest'
import { amzDate, r2ObjectUrl, r2Request, sha256Hex, signRequest } from '.'

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

/** AWS sig-v4-test-suite credentials (generic `service` in `us-east-1`). */
const SUITE_KEYS = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
}

/** S3 "Signature Calculations for the Authorization Header" examples. */
const S3_KEYS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
}

interface Vector {
  name: string
  keys: typeof SUITE_KEYS
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  amzDate: string
  region: string
  service: string
  signedHeaders: string
  signature: string
}

const SUITE = {
  keys: SUITE_KEYS,
  amzDate: '20150830T123600Z',
  region: 'us-east-1',
  service: 'service',
  signedHeaders: 'host;x-amz-date',
} as const

const S3 = {
  keys: S3_KEYS,
  amzDate: '20130524T000000Z',
  region: 'us-east-1',
  service: 's3',
} as const

const VECTORS: readonly Vector[] = [
  {
    ...SUITE,
    name: 'suite get-vanilla',
    method: 'GET',
    url: 'https://example.amazonaws.com/',
    headers: { 'X-Amz-Date': SUITE.amzDate },
    signature:
      '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  },
  {
    ...SUITE,
    name: 'suite get-vanilla-query-order-key-case',
    method: 'GET',
    url: 'https://example.amazonaws.com/?Param2=value2&Param1=value1',
    headers: { 'X-Amz-Date': SUITE.amzDate },
    signature:
      'b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500',
  },
  {
    ...SUITE,
    name: 'suite post-vanilla',
    method: 'POST',
    url: 'https://example.amazonaws.com/',
    headers: { 'X-Amz-Date': SUITE.amzDate },
    signature:
      '5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b',
  },
  {
    ...S3,
    name: 's3 GET object with range',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: {
      Range: 'bytes=0-9',
      'x-amz-content-sha256': EMPTY_SHA256,
      'x-amz-date': S3.amzDate,
    },
    signedHeaders: 'host;range;x-amz-content-sha256;x-amz-date',
    signature:
      'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
  },
  {
    ...S3,
    name: 's3 PUT object with body',
    method: 'PUT',
    url: 'https://examplebucket.s3.amazonaws.com/test$file.text',
    headers: {
      Date: 'Fri, 24 May 2013 00:00:00 GMT',
      'x-amz-date': S3.amzDate,
      'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      'x-amz-content-sha256':
        '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    },
    body: 'Welcome to Amazon S3.',
    signedHeaders:
      'date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class',
    signature:
      '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd',
  },
  {
    ...S3,
    name: 's3 GET bucket lifecycle (valueless query)',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/?lifecycle',
    headers: { 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': S3.amzDate },
    signedHeaders: 'host;x-amz-content-sha256;x-amz-date',
    signature:
      'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543',
  },
  {
    ...S3,
    name: 's3 GET bucket list (query string)',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J',
    headers: { 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': S3.amzDate },
    signedHeaders: 'host;x-amz-content-sha256;x-amz-date',
    signature:
      '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
  },
]

describe('signRequest (AWS SigV4 test vectors)', () => {
  it.each(VECTORS)('$name', async (vector) => {
    const payloadHash = await sha256Hex(vector.body ?? '')
    const signed = await signRequest(
      {
        method: vector.method,
        url: new URL(vector.url),
        headers: vector.headers,
        payloadHash,
        amzDate: vector.amzDate,
        region: vector.region,
        service: vector.service,
      },
      vector.keys,
    )

    expect(signed.authorization).toBe(
      `AWS4-HMAC-SHA256 Credential=${vector.keys.accessKeyId}/${vector.amzDate.slice(0, 8)}/${vector.region}/${vector.service}/aws4_request, SignedHeaders=${vector.signedHeaders}, Signature=${vector.signature}`,
    )
  })

  it('hashes the PUT vector body to its x-amz-content-sha256', async () => {
    expect(await sha256Hex('Welcome to Amazon S3.')).toBe(
      '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    )
  })

  it('adds x-amz-date when absent and never returns host', async () => {
    const signed = await signRequest(
      {
        method: 'GET',
        url: new URL('https://example.amazonaws.com/'),
        headers: {},
        payloadHash: EMPTY_SHA256,
        amzDate: SUITE.amzDate,
        region: SUITE.region,
        service: SUITE.service,
      },
      SUITE_KEYS,
    )

    expect(signed.authorization).toContain(
      'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    )
    expect(Object.keys(signed).sort()).toEqual(['authorization', 'x-amz-date'])
  })

  it('sorts query pairs by name, then value, whatever the input order', async () => {
    const sign = (query: string) =>
      signRequest(
        {
          method: 'GET',
          url: new URL(`https://example.amazonaws.com/${query}`),
          headers: {},
          payloadHash: EMPTY_SHA256,
          amzDate: SUITE.amzDate,
          region: SUITE.region,
          service: SUITE.service,
        },
        SUITE_KEYS,
      )

    const sorted = await sign('?a=1&a=2&a-b=0&b=0')

    expect(await sign('?b=0&a=2&a-b=0&a=1')).toEqual(sorted)
    expect(await sign('?a-b=0&b=0&a=1&a=2')).toEqual(sorted)
    expect(await sign('?a=1&a=3&a-b=0&b=0')).not.toEqual(sorted)
  })

  it('folds header value whitespace and lowercases names', async () => {
    const base = {
      method: 'GET',
      url: new URL('https://example.amazonaws.com/'),
      payloadHash: EMPTY_SHA256,
      amzDate: SUITE.amzDate,
      region: SUITE.region,
      service: SUITE.service,
    }

    const messy = await signRequest(
      { ...base, headers: { 'My-Header': '  a   b  ' } },
      SUITE_KEYS,
    )
    const clean = await signRequest(
      { ...base, headers: { 'my-header': 'a b' } },
      SUITE_KEYS,
    )

    expect(messy).toEqual(clean)
    expect(clean['my-header']).toBe('a b')
  })
})

const TARGET = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'my-site',
  accessKeyId: 'AKIDEXAMPLE0123456789',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
}

const NOW = new Date(Date.UTC(2026, 10, 12, 21, 5, 9, 123))

describe('amzDate', () => {
  it('formats UTC without separators or millis', () => {
    expect(amzDate(NOW)).toBe('20261112T210509Z')
  })
})

describe('r2ObjectUrl', () => {
  it('builds the path-style account endpoint, encoding each key segment', () => {
    expect(r2ObjectUrl(TARGET, 'books/a b/x$(1)*.avif').href).toBe(
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/my-site/books/a%20b/x%24%281%29%2A.avif',
    )
  })
})

describe('r2Request', () => {
  const body = new TextEncoder().encode('<!doctype html>')

  it('signs a PUT with the body hash in region auto, service s3', async () => {
    const request = await r2Request(TARGET, {
      method: 'PUT',
      key: 'index.html',
      body,
      contentType: 'text/html',
      now: NOW,
    })
    const bodyHash = await sha256Hex(body)
    const expected = await signRequest(
      {
        method: 'PUT',
        url: new URL(request.url),
        headers: {
          'content-type': 'text/html',
          'x-amz-content-sha256': bodyHash,
        },
        payloadHash: bodyHash,
        amzDate: '20261112T210509Z',
        region: 'auto',
        service: 's3',
      },
      TARGET,
    )

    expect(request.method).toBe('PUT')
    expect(request.url).toBe(
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/my-site/index.html',
    )
    expect(request.headers).toEqual(expected)
    expect(request.headers['x-amz-content-sha256']).toBe(bodyHash)
    expect(request.headers.authorization).toContain(
      `Credential=${TARGET.accessKeyId}/20261112/auto/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date,`,
    )
  })

  it.each(['HEAD', 'DELETE'] as const)(
    'signs %s with the empty-body hash and no content type',
    async (method) => {
      const request = await r2Request(TARGET, {
        method,
        key: 'a.json',
        now: NOW,
      })

      expect(request.method).toBe(method)
      expect(request.headers['x-amz-content-sha256']).toBe(EMPTY_SHA256)
      expect(request.headers).not.toHaveProperty('content-type')
      expect(request.headers.authorization).toContain(
        'SignedHeaders=host;x-amz-content-sha256;x-amz-date,',
      )
    },
  )

  it('never puts the secret in the URL or headers', async () => {
    const request = await r2Request(TARGET, {
      method: 'PUT',
      key: 'k',
      body,
      now: NOW,
    })

    expect(JSON.stringify(request)).not.toContain(TARGET.secretAccessKey)
  })
})
