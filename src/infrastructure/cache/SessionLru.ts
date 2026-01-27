import { LRUCache } from 'lru-cache';

interface CacheOptions {
    max?: number;
    ttl?: number;
}

export class SessionCache {
    private static instance: SessionCache;
    private cache: LRUCache<string, any>;

    private constructor(options?: CacheOptions) {
        this.cache = new LRUCache<string, any>({
            max: options?.max || 500, // Store last 500 items
            ttl: options?.ttl || 1000 * 60 * 60, // 1 Hour TTL
        });
    }

    public static getInstance(options?: CacheOptions): SessionCache {
        if (!SessionCache.instance) {
            SessionCache.instance = new SessionCache(options);
        }
        return SessionCache.instance;
    }

    /**
     * Store item in cache.
     * key should be composite: `userId:sessionId:key`
     */
    public set(key: string, value: any): void {
        this.cache.set(key, value);
    }

    public get<T>(key: string): T | undefined {
        return this.cache.get(key) as T;
    }

    public has(key: string): boolean {
        return this.cache.has(key);
    }

    public delete(key: string): void {
        this.cache.delete(key);
    }

    public clear(): void {
        this.cache.clear();
    }
}
