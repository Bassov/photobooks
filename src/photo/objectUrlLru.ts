export interface ObjectUrlLruOptions {
  capacity: number
}

/**
 * Bounded object-URL cache. Evicted entries are revoked.
 * Values are opaque URL strings created by the caller.
 */
export class ObjectUrlLru {
  private readonly capacity: number
  private readonly order: string[] = []
  private readonly urls = new Map<string, string>()

  constructor(options: ObjectUrlLruOptions) {
    if (options.capacity < 1) {
      throw new Error('ObjectUrlLru capacity must be >= 1')
    }
    this.capacity = options.capacity
  }

  get size(): number {
    return this.urls.size
  }

  get(key: string): string | undefined {
    const url = this.urls.get(key)
    if (url === undefined) {
      return undefined
    }
    this.touch(key)
    return url
  }

  set(key: string, url: string): void {
    const existing = this.urls.get(key)
    if (existing !== undefined) {
      if (existing !== url) {
        URL.revokeObjectURL(existing)
      }
      this.urls.set(key, url)
      this.touch(key)
      return
    }

    this.urls.set(key, url)
    this.order.push(key)
    this.evictIfNeeded()
  }

  has(key: string): boolean {
    return this.urls.has(key)
  }

  delete(key: string): boolean {
    const url = this.urls.get(key)
    if (url === undefined) {
      return false
    }
    URL.revokeObjectURL(url)
    this.urls.delete(key)
    const index = this.order.indexOf(key)
    if (index >= 0) {
      this.order.splice(index, 1)
    }
    return true
  }

  clear(): void {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url)
    }
    this.urls.clear()
    this.order.length = 0
  }

  private touch(key: string): void {
    const index = this.order.indexOf(key)
    if (index >= 0) {
      this.order.splice(index, 1)
    }
    this.order.push(key)
  }

  private evictIfNeeded(): void {
    while (this.urls.size > this.capacity) {
      const oldest = this.order.shift()
      if (oldest === undefined) {
        return
      }
      const url = this.urls.get(oldest)
      if (url !== undefined) {
        URL.revokeObjectURL(url)
      }
      this.urls.delete(oldest)
    }
  }
}
