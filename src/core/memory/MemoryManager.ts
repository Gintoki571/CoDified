import { db } from '../../infrastructure/database';
import { nodes, edges, memoryEvents } from '../../infrastructure/database/schema';
import { Embedder } from '../../infrastructure/vector/Embedder';
import { LanceDbManager } from '../../infrastructure/vector/LanceDbManager';
import { SessionCache } from '../../infrastructure/cache/SessionLru';
import { GraphQueryEngine } from '../graph/GraphQueryEngine';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class MemoryManager {
    private embedder: Embedder;
    private vectorDb: LanceDbManager;
    private cache: SessionCache;
    private graphEngine: GraphQueryEngine;

    constructor() {
        this.embedder = Embedder.getInstance();
        this.vectorDb = LanceDbManager.getInstance();
        this.cache = SessionCache.getInstance();
        this.graphEngine = new GraphQueryEngine();
    }

    /**
     * Adds a new memory string.
     * Orchestrates: Embedding -> VectorDB -> SQLite Node -> Links.
     */
    async addMemory(content: string, userId: string, metadata: any = {}): Promise<string> {
        // 1. Generate Embedding
        const vector = await this.embedder.embed(content);
        const vectorId = uuidv4();
        const timestamp = Date.now();

        // 2. Save to Vector Store (LanceDB)
        // Note: In real production, we might want to do this parallel or transactionally carefully.
        // If SQLite fails, we should delete this vector (Compensation).
        await this.vectorDb.addVectors([{
            id: vectorId,
            vector: vector,
            text: content,
            userId: userId,
            timestamp: timestamp,
            metadata: JSON.stringify(metadata)
        }]);

        try {
            // 3. Save to Graph Store (SQLite)
            // Name generation strategy: Use a summary or slice? For now, using content slice or UUID if long.
            // Better: 'Memory-' + short hash.
            const name = `mem-${vectorId.substring(0, 8)}`;

            const result = await db.insert(nodes).values({
                name: name,
                type: 'memory',
                content: content,
                userId: userId,
                embeddingId: vectorId, // Link to vector
                createdAt: new Date(timestamp),
                updatedAt: new Date(timestamp)
            }).returning({ id: nodes.id });

            const nodeId = result[0].id;

            // 4. Log Event
            await db.insert(memoryEvents).values({
                type: 'MEMORY_ADDED',
                description: 'User added new memory block',
                userId: userId,
                metadata: JSON.stringify({ vectorId, nodeId, length: content.length })
            });

            // 5. Update Cache (Write-through)
            this.cache.set(`recent:${userId}`, { content, timestamp });

            return name;
        } catch (error) {
            // Rollback Vector Store
            console.error("Failed to save to SQLite, rolling back Vector Store...", error);
            await this.vectorDb.deleteVectors([vectorId]);
            throw error;
        }
    }

    /**
     * Search memory using Hybrid Strategy (Vector + Graph).
     */
    async search(query: string, userId: string): Promise<any[]> {
        // 1. Vector Search
        const queryVec = await this.embedder.embed(query);
        const vectorResults = await this.vectorDb.search(queryVec, userId, 5);

        // 2. Hydrate & Expand from Graph
        const results = [];
        for (const vecRes of vectorResults) {
            // Find SQLite Node by embeddingId
            const node = await db.query.nodes.findFirst({
                where: eq(nodes.embeddingId, vecRes.id)
            });

            if (node) {
                // Graph Expansion (1 hop)
                const subgraph = await this.graphEngine.findSubgraph(node.name, userId, 1);
                results.push({
                    memory: node,
                    similarity: 0.0, // LanceDB gives distance usually, assume sorted
                    context: subgraph
                });
            } else {
                // Fallback if graph node missing (should process sync via audit)
                results.push({ memory: vecRes, context: null });
            }
        }

        return results;
    }
}
