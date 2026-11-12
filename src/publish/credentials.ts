/**
 * Cloudflare R2 hosting credentials. The token lives only in this module's
 * editor-origin IndexedDB database — never in the library folder, book files,
 * localStorage, URLs or exported site files — and is never logged. Only
 * `accountId` and `bucket` may appear in messages.
 */

export interface R2Credentials {
  /** Cloudflare account id: 32 lowercase hex. */
  accountId: string
  bucket: string
  /** Bucket-scoped Object Read & Write token: access key id. */
  accessKeyId: string
  secretAccessKey: string
  /** Public `https:` origin (custom domain) the site is served from. */
  publicBaseUrl: string
}

type CredentialField = keyof R2Credentials

export type CredentialsValidation =
  | { ok: true; value: R2Credentials }
  | { ok: false; errors: Partial<Record<CredentialField, string>> }

const FORMATS: Record<
  Exclude<CredentialField, 'publicBaseUrl'>,
  { pattern: RegExp; message: string }
> = {
  accountId: {
    pattern: /^[0-9a-f]{32}$/,
    message: 'Account ID must be 32 lowercase hex characters',
  },
  bucket: {
    pattern: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
    message:
      'Bucket must be 3–63 lowercase letters, digits or hyphens, starting and ending with a letter or digit',
  },
  accessKeyId: {
    pattern: /^[A-Za-z0-9]{20,64}$/,
    message: 'Access key ID must be 20–64 letters or digits',
  },
  secretAccessKey: {
    pattern: /^[A-Za-z0-9/+=]{40,128}$/,
    message: 'Secret access key must be 40–128 characters (A–Z, 0–9, / + =)',
  },
}

const FIELDS: readonly CredentialField[] = [
  'accountId',
  'bucket',
  'accessKeyId',
  'secretAccessKey',
  'publicBaseUrl',
]

function publicUrlError(value: string): string | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return 'Public URL must be a valid URL'
  }
  if (url.protocol !== 'https:') return 'Public URL must start with https://'
  if (url.username !== '' || url.password !== '') {
    return 'Public URL must not contain a user name or password'
  }
  if (/[?#]/.test(value)) {
    return 'Public URL must not contain a query or fragment'
  }
  return undefined
}

/** Field formats; messages name the field, never echo its value. */
export function validateCredentials(input: unknown): CredentialsValidation {
  const record =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {}
  const errors: Partial<Record<CredentialField, string>> = {}
  for (const field of FIELDS) {
    const value = record[field]
    if (typeof value !== 'string' || value === '') {
      errors[field] = 'Required'
    } else if (/\s/.test(value)) {
      errors[field] = 'Must not contain spaces or line breaks'
    } else {
      const error =
        field === 'publicBaseUrl'
          ? publicUrlError(value)
          : FORMATS[field].pattern.test(value)
            ? undefined
            : FORMATS[field].message
      if (error !== undefined) errors[field] = error
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  const value = Object.fromEntries(
    FIELDS.map((field) => [field, record[field]]),
  ) as unknown as R2Credentials
  return { ok: true, value }
}

const REDACTED = '[redacted]'

function base64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(
    /=*$/,
    '',
  )
}

/** `text` with the key id and secret (raw, URL-encoded, base64) replaced. */
export function redact(
  text: string,
  credentials: Pick<R2Credentials, 'accessKeyId' | 'secretAccessKey'>,
): string {
  const secrets = [credentials.accessKeyId, credentials.secretAccessKey]
    .filter((secret) => secret !== '')
    .flatMap((secret) => [secret, encodeURIComponent(secret), base64(secret)])
    // Longest first, so a form is not cut by a shorter one inside it.
    .sort((a, b) => b.length - a.length)
  return secrets.reduce(
    (result, secret) => result.split(secret).join(REDACTED),
    text,
  )
}

export const SECRETS_DB_NAME = 'photobooks-secrets'
const STORE = 'r2'
const KEY = 'credentials'

export interface CredentialStore {
  /** Stored credentials, or `undefined` when none or no longer valid. */
  load: () => Promise<R2Credentials | undefined>
  /** Validates first; throws an error naming the invalid fields only. */
  save: (credentials: R2Credentials) => Promise<void>
  clear: () => Promise<void>
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(new Error('Hosting credentials storage failed'))
    }
  })
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(SECRETS_DB_NAME, 1)
  request.onupgradeneeded = () => {
    request.result.createObjectStore(STORE)
  }
  return requestResult(request)
}

async function run<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb(factory)
  try {
    return await requestResult(
      action(db.transaction(STORE, mode).objectStore(STORE)),
    )
  } finally {
    db.close()
  }
}

/** Store in the editor origin's own IndexedDB database `photobooks-secrets`. */
export function createCredentialStore(
  factory: IDBFactory = indexedDB,
): CredentialStore {
  return {
    load: async () => {
      const stored = await run<unknown>(factory, 'readonly', (store) =>
        store.get(KEY),
      )
      const checked = validateCredentials(stored)
      return checked.ok ? checked.value : undefined
    },
    save: async (credentials) => {
      const checked = validateCredentials(credentials)
      if (!checked.ok) {
        throw new Error(
          `Invalid hosting credentials: ${Object.keys(checked.errors).join(', ')}`,
        )
      }
      await run(factory, 'readwrite', (store) => store.put(checked.value, KEY))
    },
    clear: async () => {
      await run(factory, 'readwrite', (store) => store.delete(KEY))
    },
  }
}
