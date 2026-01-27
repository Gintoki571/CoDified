import { getDatabase } from '../../infrastructure/database';
import { nodes, edges, memoryEvents } from '../../infrastructure/database/schema';
import { Embedder } from '../../infrastructure/vector/Embedder';
import { LanceDbManager } from '../../infrastructure/vector/LanceDbManager';
import { SessionCache } from '../../infrastructure/cache/SessionLru';
import { GraphQueryEngine } from '../graph/GraphQueryEngine';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { ErrorFactory } from '../errors';
import { TransactionManager } from '../transactions/TransactionManager';

export class MemoryManager {
    private embedder: Embedder;
    private vectorDb: LanceDbManager;
    private cache: SessionCache;
    private graphEngine: GraphQueryEngine;
    private txManager: TransactionManager;

    constructor() {
        this.embedder = Embedder.getInstance();
        this.vectorDb = LanceDbManager.getInstance();
        this.cache = SessionCache.getInstance();
        this.graphEngine = new GraphQueryEngine();
        this.txManager = TransactionManager.getInstance();
    }

    /**
     * Adds a new memory string.
     * Orchestrates: Embedding -> VectorDB -> SQLite Node -> Links.
     */
    async addMemory(content: string, userId: string, metadata: any = {}): Promise<string> {
        return this.txManager.executeTransaction(async () => {
            // 1. Generate Embedding
            const vector = await this.embedder.embed(content);
            const vectorId = uuidv4();
            const timestamp = Date.now();

            // 2. Save to Vector Store (LanceDB)
            await this.vectorDb.addVectors([{
                id: vectorId,
                vector: vector,
                text: content,
                userId: userId,
                timestamp: timestamp,
                nodeName: `mem-${vectorId.substring(0, 8)}`, // For validation check
                metadata: JSON.stringify(metadata)
            }]);

            // Register compensation: delete vector if SQLite fails
            this.txManager.addRollbackAction(
                async () => { await this.vectorDb.deleteVectors([vectorId]); },
                `Delete vector ${vectorId} from LanceDB`
            );

            // 3. Save to Graph Store (SQLite)
            const name = `mem-${vectorId.substring(0, 8)}`;

            const result = await getDatabase().insert(nodes).values({
                name: name,
                type: 'memory',
                content: content,
                userId: userId,
                embeddingId: vectorId,
                createdAt: new Date(timestamp),
                updatedAt: new Date(timestamp)
            }).returning({ id: nodes.id });

            const nodeId = result[0].id;

            // 4. Log Event
            await getDatabase().insert(memoryEvents).values({
                type: 'MEMORY_ADDED',
                description: 'User added new memory block',
                userId: userId,
                metadata: JSON.stringify({ vectorId, nodeId, length: content.length })
            });

            // 5. Update Cache
            this.cache.set(`recent:${userId}`, { content, timestamp });

            return name;
        });
    }

    /**
     * Search memory using Hybrid Strategy (Vector + Graph).
     */
    async search(query: string, userId: string): Promise<any[]> {
        // 1. Vector Search
        const queryVec = await this.embedder.embed(query);
        const vectorResults = await this.vectorDb.search(queryVec, userId, { limit: 5 });

        // 2. Hydrate & Expand from Graph
        const results = [];
        for (const vecRes of vectorResults) {
            // Find SQLite Node by embeddingId
            const node = await getDatabase().query.nodes.findFirst({
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
