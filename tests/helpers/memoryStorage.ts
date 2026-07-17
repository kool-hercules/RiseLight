import type { StorageLike } from '../../utils/settings'

export class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  constructor(
    initialValues: Record<string, string> = {},
    private readonly failReads = false,
    private readonly failWrites = false
  ) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value)
    }
  }

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('Storage reads are blocked')
    }

    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('Storage writes are blocked')
    }

    this.values.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failWrites) {
      throw new Error('Storage writes are blocked')
    }

    this.values.delete(key)
  }
}
