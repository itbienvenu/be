
class SimpleCache {
    private cache = new Map<string, { value: any, expiresAt: number }>();

    constructor() {
        // Automatically clear expired entries every 5 minutes to prevent memory leaks
        setInterval(() => this.clearExpired(), 5 * 60 * 1000).unref();
    }

    /**
     * Set a value in the cache.
     * @param key Cache key
     * @param value Value to store
     * @param ttl Time to live in milliseconds (default 5 minutes)
     */
    set(key: string, value: any, ttl: number = 5 * 60 * 1000): void {
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl
        });
    }

    /**
     * Get a value from the cache.
     * @param key Cache key
     */
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value as T;
    }

    /**
     * Remove an item from the cache.
     * @param key Cache key
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all expired items.
     */
    clearExpired(): void {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Delete all items with keys starting with the given prefix.
     * @param prefix Key prefix
     */
    deleteByPrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }
}

export const cache = new SimpleCache();
