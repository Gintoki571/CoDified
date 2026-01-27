import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class Embedder {
    private static instance: Embedder;
    private pipe: any = null;
    private cacheDir: string;
    private modelName: string = 'Xenova/all-MiniLM-L6-v2';
    private mockMode: boolean = false;

    private constructor() {
        this.cacheDir = path.join(process.cwd(), 'data', 'cache', 'embeddings');
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
        if (this.mockMode) return null;
        if (!this.pipe) {
            try {
                console.log(`Loading embedding model: ${this.modelName}...`);
                // Dynamic import to handle installation failure gracefully
                const { pipeline } = await import('@xenova/transformers');
                this.pipe = await pipeline('feature-extraction', this.modelName);
            } catch (error) {
                console.warn('⚠️  @xenova/transformers not available. Switching to MOCK MODE.');
                this.mockMode = true;
                return null;
            }
        }
        return this.pipe;
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
        const pipe = await this.getPipeline();
        let embedding: number[];

        if (this.mockMode || !pipe) {
            // Mock Embedding (384 dimensions for MiniLM)
            console.log(`[MockEmbedder] Generating random vector for: "${text.substring(0, 20)}..."`);
            embedding = Array.from({ length: 384 }, () => Math.random());
        } else {
            const result = await pipe(text, { pooling: 'mean', normalize: true });
            embedding = Array.from(result.data as Float32Array);
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
