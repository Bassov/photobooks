import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import {
  createCredentialStore,
  forgetCredentials,
  loadHostingSummary,
  redact,
  SECRETS_DB_NAME,
  validateCredentials,
  type HostingStatus,
  type R2Credentials,
} from './credentials'

const VALID: R2Credentials = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'my-site-1',
  accessKeyId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  publicBaseUrl: 'https://photos.example.com',
}

function errorsFor(input: unknown): Record<string, string> {
  const result = validateCredentials(input)
  return result.ok ? {} : result.errors
}

describe('validateCredentials', () => {
  it('accepts valid credentials and returns only the known fields', () => {
    expect(validateCredentials({ ...VALID, extra: 'x' })).toEqual({
      ok: true,
      value: VALID,
    })
  })

  it('marks every field required for a non-object', () => {
    expect(Object.keys(errorsFor(null)).sort()).toEqual([
      'accessKeyId',
      'accountId',
      'bucket',
      'publicBaseUrl',
      'secretAccessKey',
    ])
    expect(errorsFor({ ...VALID, bucket: 3 })).toEqual({ bucket: 'Required' })
    expect(errorsFor({ ...VALID, bucket: '' })).toEqual({ bucket: 'Required' })
  })

  it.each<[keyof R2Credentials, string]>([
    ['accountId', '0123456789ABCDEF0123456789ABCDEF'],
    ['accountId', '0123456789abcdef0123456789abcde'],
    ['bucket', 'ab'],
    ['bucket', '-site'],
    ['bucket', 'site-'],
    ['bucket', 'My-Site'],
    ['bucket', 'a'.repeat(64)],
    ['accessKeyId', 'a'.repeat(19)],
    ['accessKeyId', 'a'.repeat(65)],
    ['accessKeyId', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d-'],
    ['secretAccessKey', 'a'.repeat(39)],
    ['secretAccessKey', 'a'.repeat(129)],
    ['secretAccessKey', `${'a'.repeat(40)}_`],
    ['publicBaseUrl', 'http://photos.example.com'],
    ['publicBaseUrl', 'notaurl'],
    ['publicBaseUrl', 'https://user:pw@photos.example.com'],
    ['publicBaseUrl', 'https://user@photos.example.com'],
    ['publicBaseUrl', 'https://:pw@photos.example.com'],
    ['publicBaseUrl', 'https://photos.example.com/?token=1'],
    ['publicBaseUrl', 'https://photos.example.com/#x'],
    ['publicBaseUrl', 'https://photos.example.com/?'],
  ])('rejects %s = %j', (field, value) => {
    const errors = errorsFor({ ...VALID, [field]: value })

    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field]).not.toContain(value)
  })

  it.each<keyof R2Credentials>([
    'accountId',
    'bucket',
    'accessKeyId',
    'secretAccessKey',
    'publicBaseUrl',
  ])('rejects whitespace in %s', (field) => {
    expect(errorsFor({ ...VALID, [field]: `${VALID[field]} ` })).toEqual({
      [field]: 'Must not contain spaces or line breaks',
    })
    expect(errorsFor({ ...VALID, [field]: `\n${VALID[field]}` })).toEqual({
      [field]: 'Must not contain spaces or line breaks',
    })
  })

  it('accepts boundary lengths', () => {
    expect(
      validateCredentials({
        ...VALID,
        bucket: `a${'-'.repeat(61)}b`,
        accessKeyId: 'A'.repeat(64),
        secretAccessKey: '/+='.repeat(42) + 'ab',
      }).ok,
    ).toBe(true)
    expect(
      validateCredentials({
        ...VALID,
        bucket: 'a1b',
        accessKeyId: 'A'.repeat(20),
        secretAccessKey: 'a'.repeat(40),
        publicBaseUrl: 'https://photos.example.com/site/',
      }).ok,
    ).toBe(true)
  })
})

describe('redact', () => {
  const secret = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  const keys = { accessKeyId: VALID.accessKeyId, secretAccessKey: secret }

  it('hides raw, URL-encoded and base64 forms of both keys', () => {
    const base64 = btoa(secret).replace(/=+$/, '')
    const text = [
      `id=${VALID.accessKeyId}`,
      `raw=${secret}`,
      `url=${encodeURIComponent(secret)}`,
      `b64=${base64}==`,
      `bucket=${VALID.bucket}`,
    ].join(' ')

    expect(redact(text, keys)).toBe(
      `id=[redacted] raw=[redacted] url=[redacted] b64=[redacted]== bucket=${VALID.bucket}`,
    )
  })

  it('hides a secret that contains the key id as a whole', () => {
    const id = 'AKID0123456789ABCDEF'
    const longer = `${id}wJalrXUtnFEMIK7MDENGbPxRfi`

    expect(
      redact(`x ${longer} y`, { accessKeyId: id, secretAccessKey: longer }),
    ).toBe('x [redacted] y')
  })

  it('leaves text without secrets unchanged, also for empty keys', () => {
    expect(redact('upload failed: 403', keys)).toBe('upload failed: 403')
    expect(redact('abc', { accessKeyId: '', secretAccessKey: '' })).toBe('abc')
  })
})

describe('createCredentialStore', () => {
  it('round-trips credentials through the photobooks-secrets database', async () => {
    const factory = new IDBFactory()
    const store = createCredentialStore(factory)

    expect(await store.load()).toBeUndefined()
    await store.save(VALID)
    expect(await createCredentialStore(factory).load()).toEqual(VALID)

    const names = (await factory.databases()).map((db) => db.name)
    expect(names).toEqual([SECRETS_DB_NAME])
  })

  it('closes its connections, so the database can be deleted unblocked', async () => {
    const factory = new IDBFactory()
    const store = createCredentialStore(factory)
    await store.save(VALID)
    await store.load()
    let blocked = false

    await new Promise<void>((resolve) => {
      const request = factory.deleteDatabase(SECRETS_DB_NAME)
      request.onblocked = () => {
        blocked = true
      }
      request.onsuccess = () => {
        resolve()
      }
    })

    expect(blocked).toBe(false)
  })

  it('rejects with a value-free error when storage fails', async () => {
    const factory = new IDBFactory()
    await new Promise<void>((resolve) => {
      const request = factory.open(SECRETS_DB_NAME, 2)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
    })

    await expect(createCredentialStore(factory).save(VALID)).rejects.toThrow(
      /^Hosting credentials storage failed$/,
    )
  })

  it('round-trips the last check status', async () => {
    const store = createCredentialStore(new IDBFactory())
    const failed: HostingStatus = {
      checkedAtMs: 1_000,
      ok: false,
      code: 'key',
      message: 'Replace the token.',
    }

    expect(await store.loadStatus()).toBeNull()
    await store.saveStatus({ checkedAtMs: 5, ok: true })
    expect(await store.loadStatus()).toEqual({ checkedAtMs: 5, ok: true })
    await store.saveStatus(failed)
    expect(await store.loadStatus()).toEqual(failed)
  })

  it.each([
    ['not an object', 'ok'],
    ['no time', { ok: true }],
    ['infinite time', { checkedAtMs: Infinity, ok: true }],
    ['unknown code', { checkedAtMs: 1, ok: false, code: 'x', message: 'm' }],
    ['no message', { checkedAtMs: 1, ok: false, code: 'key' }],
    ['no ok flag', { checkedAtMs: 1, code: 'key', message: 'm' }],
  ])('refuses a status with %s', async (_, status) => {
    const store = createCredentialStore(new IDBFactory())

    await expect(store.saveStatus(status as HostingStatus)).rejects.toThrow(
      /^Invalid hosting status$/,
    )
    expect(await store.loadStatus()).toBeNull()
  })

  it('keeps only the status fields of a passing check', async () => {
    const store = createCredentialStore(new IDBFactory())
    const extra = { checkedAtMs: 7, ok: true, message: 'x' } as HostingStatus

    await store.saveStatus(extra)

    expect(await store.loadStatus()).toEqual({ checkedAtMs: 7, ok: true })
  })

  it('forget deletes the credentials and the status', async () => {
    const factory = new IDBFactory()
    const store = createCredentialStore(factory)
    await store.save(VALID)
    await store.saveStatus({ checkedAtMs: 1, ok: true })

    await forgetCredentials(factory)

    expect(await store.load()).toBeUndefined()
    expect(await store.loadStatus()).toBeNull()
    expect(await loadHostingSummary(factory)).toBeNull()
  })

  it('refuses invalid credentials naming fields, never values', async () => {
    const store = createCredentialStore(new IDBFactory())
    const bad = { ...VALID, secretAccessKey: `${VALID.secretAccessKey} ` }

    const error = await store.save(bad).then(
      () => undefined,
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      'Invalid hosting credentials: secretAccessKey',
    )
    expect(await store.load()).toBeUndefined()
  })

  it('treats a stored record that no longer validates as absent', async () => {
    const factory = new IDBFactory()
    await createCredentialStore(factory).save(VALID)
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open(SECRETS_DB_NAME)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
    await new Promise<void>((resolve) => {
      const tx = db.transaction('r2', 'readwrite')
      tx.objectStore('r2').put({ ...VALID, bucket: 'BAD' }, 'credentials')
      tx.oncomplete = () => {
        resolve()
      }
    })
    db.close()

    expect(await createCredentialStore(factory).load()).toBeUndefined()
  })
})

describe('loadHostingSummary', () => {
  it('is null when nothing is stored', async () => {
    expect(await loadHostingSummary(new IDBFactory())).toBeNull()
  })

  it('shows the access key tail and the status, never the secret', async () => {
    const factory = new IDBFactory()
    const store = createCredentialStore(factory)
    await store.save(VALID)

    expect(await loadHostingSummary(factory)).toEqual({
      accountId: VALID.accountId,
      bucket: VALID.bucket,
      accessKeyTail: 'c5d6',
      publicBaseUrl: VALID.publicBaseUrl,
      status: null,
    })

    await store.saveStatus({ checkedAtMs: 9, ok: true })
    const summary = await loadHostingSummary(factory)
    expect(summary?.status).toEqual({ checkedAtMs: 9, ok: true })
    const text = JSON.stringify(summary)
    expect(text).not.toContain(VALID.secretAccessKey)
    expect(text).not.toContain(VALID.accessKeyId)
  })
})
