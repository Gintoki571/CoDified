import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Mutex } from 'async-mutex';
import { CONFIG } from '../../config/config';
import { ENV } from '../../config/env';

export class Embedder {
    private static instance: Embedder;
    private pipe: any = null;
    private cacheDir: string;
    private modelName: string = ENV.EMBEDDING_MODEL;
    private provider: string = ENV.LLM_PROVIDER;
    private mockMode: boolean = false;
    private initMutex = new Mutex();

    private constructor() {
        this.cacheDir = path.join(CONFIG.PATHS.DATA_DIR, 'cache', 'embeddings');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
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
                        console.error(`Loading local embedding model: ${this.modelName}...`);
                        const { pipeline } = await import('@xenova/transformers');
                        this.pipe = await pipeline('feature-extraction', this.modelName);
                    } catch (error) {
                        console.error('⚠️  @xenova/transformers not available. Switching to MOCK MODE.');
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
            console.error('External embedding failed, falling back to mock:', error);
            return Array.from({ length: 1536 }, () => Math.random());
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

        // 1. Check Cache
        const hash = crypto.createHash('md5').update(text).digest('hex');
        const cachePath = path.join(this.cacheDir, `${hash}.json`);

        if (fs.existsSync(cachePath)) {
            try {
                const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                if (Array.isArray(cached) && cached.length > 0) {
                    return cached;
                }
            } catch (err) {
                console.warn(`Failed to read cache for ${hash}`, err);
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
                console.error(`[MockEmbedder] Generating random vector for: "${text.substring(0, 20)}..."`);
                embedding = Array.from({ length: 384 }, () => Math.random());
            } else {
                const result = await pipe(text, { pooling: 'mean', normalize: true });
                embedding = Array.from(result.data as Float32Array);
            }
        }

        // 3. Save to Cache
        try {
            fs.writeFileSync(cachePath, JSON.stringify(embedding));
        } catch (err) {
            console.error('Failed to write embedding cache', err);
        }

        return embedding;
    }
}
