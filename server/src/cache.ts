/**
 * In-memory TTL cache for hot-path data (bots, flows).
 * Eliminates repeated DB queries on every webhook.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// === Singleton caches ===

// Bot config: rarely changes, 5 min TTL
export const botCache = new MemoryCache<Record<string, unknown>>(300);

// Active flows per bot: 2 min TTL (user can edit flows more frequently)
export const flowCache = new MemoryCache<Record<string, unknown>[]>(120);

// Single flow by ID: 2 min TTL
export const flowByIdCache = new MemoryCache<Record<string, unknown>>(120);
