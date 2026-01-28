import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Mutex } from 'async-mutex';
import { CONFIG } from '../../config/config';
import { ENV } from '../../config/env';
import { LRUCache } from 'lru-cache';
import { Logger } from '../../core/logging/Logger';

export class Embedder {
    private static instance: Embedder;
    private pipe: any = null;
    private cacheDir: string;
    private memoryCache: LRUCache<string, number[]>;
    private modelName: string = ENV.EMBEDDING_MODEL;
    private provider: string = ENV.LLM_PROVIDER;
    private mockMode: boolean = false;
    private initMutex = new Mutex();

    private constructor() {
        this.cacheDir = path.join(CONFIG.PATHS.DATA_DIR, 'cache', 'embeddings');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        // Memory-bounded LRU cache (100MB approx if ~50k vectors)
        this.memoryCache = new LRUCache({
            max: 10000,
            ttl: 24 * 60 * 60 * 1000 // 24 hours
        });
    }

    public static getInstance(): Embedder {
        if (!Embedder.instance) {
            Embedder.instance = new Embedder();
        }
        return Embedder.instance;
    }

    private async getPipeline() {
        return await this.initMutex.runExclusive(async () => {
            if (this.mockMode) return null;
            if (this.provider !== 'openai' && this.provider !== 'lmstudio') {
                if (!this.pipe) {
                    try {
                        Logger.info('Embedder', `Loading local embedding model: ${this.modelName}...`);
                        const { pipeline } = await import('@xenova/transformers');
                        this.pipe = await pipeline('feature-extraction', this.modelName);
                    } catch (error) {
                        Logger.warn('Embedder', '⚠️  @xenova/transformers not available. Switching to MOCK MODE.');
                        this.mockMode = true;
                        return null;
                    }
                }
                return this.pipe;
            }
            return null; // External providers don't use local pipeline
        });
    }

    private async embedExternal(text: string): Promise<number[]> {
        const baseUrl = ENV.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const apiKey = ENV.OPENAI_API_KEY || '';

        try {
            const response = await fetch(`${baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    input: text,
                    model: this.modelName
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Embedding API failed: ${response.status} - ${errorData}`);
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            Logger.error('Embedder', 'External embedding failed:', error);

            // Hard failure in production to prevent data degradation
            if (ENV.NODE_ENV === 'production') {
                throw error;
            }

            // Secure randomness for mock embeddings (Dev/Test only)
            const randomValues = new Float32Array(1536);
            crypto.randomFillSync(randomValues);
            return Array.from(randomValues);
        }
    }

    /**
     * Generates a vector embedding for the given text.
     * Uses local filesystem cache to avoid re-computation.
     */
    public async embed(text: string): Promise<number[]> {
        if (!text || text.trim().length === 0) {
            throw new Error('Input text cannot be empty');
        }

        // 1. Check Memory Cache (L1)
        const hash = crypto.createHash('md5').update(text).digest('hex');
        const memCached = this.memoryCache.get(hash);
        if (memCached) return memCached;

        // 2. Check Disk Cache (L2)
        const cachePath = path.join(this.cacheDir, `${hash}.json`);

        if (fs.existsSync(cachePath)) {
            try {
                const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                if (Array.isArray(cached) && cached.length > 0) {
                    this.memoryCache.set(hash, cached);
                    return cached;
                }
            } catch (err) {
                Logger.warn('Embedder', `Failed to read cache for ${hash}`, err);
            }
        }

        // 2. Generate Embedding
        let embedding: number[];

        if (this.provider === 'openai' || this.provider === 'lmstudio') {
            embedding = await this.embedExternal(text);
        } else {
            const pipe = await this.getPipeline();
            if (this.mockMode || !pipe) {
                // Mock Embedding (384 dimensions for MiniLM)
                Logger.error('Embedder', `[MockEmbedder] Generating random vector for: "${text.substring(0, 20)}..."`);
                const randomValues = new Float32Array(384);
                crypto.randomFillSync(randomValues);
                embedding = Array.from(randomValues);
            } else {
                const result = await pipe(text, { pooling: 'mean', normalize: true });
                embedding = Array.from(result.data as Float32Array);
            }
        }

        // 3. Save to Cache (Both Labs)
        try {
            this.memoryCache.set(hash, embedding);
            fs.writeFileSync(cachePath, JSON.stringify(embedding));
        } catch (err) {
            Logger.error('Embedder', 'Failed to write embedding cache', err);
        }

        return embedding;
    }
}
