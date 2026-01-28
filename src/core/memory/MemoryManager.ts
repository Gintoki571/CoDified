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
import { CircuitBreaker } from '../security/CircuitBreaker';
import { EntityExtractor, ExtractedData } from '../processing/EntityExtractor';
import { Summarizer } from '../processing/Summarizer';
import { ModuleManager } from '../modules/ModuleManager';

export class MemoryManager {
    private embedder: Embedder;
    private vectorDb: LanceDbManager;
    private cache: SessionCache;
    private graphEngine: GraphQueryEngine;
    private extractor: EntityExtractor;
    private txManager: TransactionManager;
    private embeddingCircuit: CircuitBreaker;
    private vectorCircuit: CircuitBreaker;
    private extractionCircuit: CircuitBreaker;
    private summarizer: Summarizer;
    private moduleManager: ModuleManager;

    constructor() {
        this.embedder = Embedder.getInstance();
        this.vectorDb = LanceDbManager.getInstance();
        this.cache = SessionCache.getInstance();
        this.graphEngine = new GraphQueryEngine();
        this.extractor = new EntityExtractor();
        this.txManager = TransactionManager.getInstance();
        this.embeddingCircuit = new CircuitBreaker('Embedding-Model');
        this.vectorCircuit = new CircuitBreaker('LanceDB-Store');
        this.extractionCircuit = new CircuitBreaker('Entity-Extraction');
        this.summarizer = new Summarizer();
        this.moduleManager = ModuleManager.getInstance();
    }

    /**
     * Adds a new memory string.
     * Orchestrates: Embedding -> VectorDB -> SQLite Node -> Links.
     */
    async addMemory(content: string, userId: string, metadata: any = {}): Promise<string> {
        const vectorId = uuidv4();
        const timestamp = Date.now();
        const memNodeName = `mem-${vectorId.substring(0, 8)}`;

        // 1. Initial Synchronous Save (Fast path)
        await getDatabase().insert(nodes).values({
            name: memNodeName,
            type: 'memory',
            content: content,
            userId: userId,
            embeddingId: vectorId, // Placeholder for later search expansion
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp)
        });

        // 2. Trigger Background AI Processing (Slow path)
        // Note: We don't 'await' this here to keep the latency low.
        this.processInBackground(content, userId, vectorId, memNodeName, metadata).catch(err => {
            console.error(`[Background-AI] Failed to process memory ${memNodeName}:`, err);
        });

        // 3. Log Event (Sync)
        await getDatabase().insert(memoryEvents).values({
            type: 'MEMORY_ADDED_FAST',
            userId: userId,
            description: `Memory added quickly. AI processing started in background.`,
            metadata: JSON.stringify({ vectorId, nodeName: memNodeName })
        });

        // 4. Update Cache
        this.cache.set(`recent:${userId}`, { content, timestamp });

        return memNodeName;
    }

    /**
     * Handles heavy lifting (Embedding & Extraction) asynchronously.
     */
    private async processInBackground(
        content: string,
        userId: string,
        vectorId: string,
        memNodeName: string,
        metadata: any
    ): Promise<void> {
        console.info(`[Background-AI] Starting processing for ${memNodeName}...`);

        // A. Generate Embedding
        const vector = await this.embeddingCircuit.execute(async () =>
            await this.embedder.embed(content)
        );

        // B. Save to Vector Store
        await this.vectorCircuit.execute(async () =>
            await this.vectorDb.addVectors([{
                id: vectorId,
                vector: vector,
                text: content,
                userid: userId,
                timestamp: Date.now(),
                nodeName: memNodeName,
                metadata: JSON.stringify(metadata)
            }])
        );

        // C. Extract Entities
        let extractedData: ExtractedData = { entities: [], relationships: [] };
        try {
            extractedData = await this.extractionCircuit.execute(async () =>
                await this.extractor.extract(content)
            );
        } catch (err) {
            console.error(`[Background-AI] Extraction failed for ${memNodeName}:`, err);
        }

        // D. Populate Graph (SQLite) 
        // We use a separate transaction for this part
        await this.txManager.executeTransaction(async () => {
            const mainNodeResult = await getDatabase().select().from(nodes).where(
                and(eq(nodes.name, memNodeName), eq(nodes.userId, userId))
            ).limit(1);

            if (mainNodeResult.length === 0) return;
            const mainNodeId = mainNodeResult[0].id;

            const nodeMap = new Map<string, number>();
            nodeMap.set(memNodeName, mainNodeId);

            for (const entity of extractedData.entities) {
                const eid = await this.getOrCreateNode(entity.name, entity.type, userId, entity.metadata);
                nodeMap.set(entity.name, eid);
                await this.createEdge(mainNodeId, eid, 'mentions', userId);
            }

            for (const rel of extractedData.relationships) {
                const fromId = nodeMap.get(rel.from) || await this.getOrCreateNode(rel.from, 'concept', userId);
                const toId = nodeMap.get(rel.to) || await this.getOrCreateNode(rel.to, 'concept', userId);
                await this.createEdge(fromId, toId, rel.type, userId);
            }
        });

        console.info(`[Background-AI] Completed processing for ${memNodeName}.`);
    }

    /**
     * Finds or creates a node by name and userId.
     */
    private async getOrCreateNode(name: string, type: string, userId: string, metadata: any = {}): Promise<number> {
        const normalized = name.trim();
        const existing = await getDatabase().query.nodes.findFirst({
            where: and(eq(nodes.name, normalized), eq(nodes.userId, userId))
        });

        if (existing) return existing.id;

        const result = await getDatabase().insert(nodes).values({
            name: normalized,
            type: type || 'concept',
            userId: userId,
            metadata: metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning({ id: nodes.id });

        return result[0].id;
    }

    /**
     * Creates an edge between two nodes.
     */
    private async createEdge(sourceId: number, targetId: number, type: string, userId: string): Promise<void> {
        if (sourceId === targetId) return; // Prevent self-loops

        await getDatabase().insert(edges).values({
            sourceId,
            targetId,
            type: type.toLowerCase() || 'related_to',
            userId: userId,
            weight: 1.0
        });
    }

    /**
     * Search memory using Hybrid Strategy (Vector + Graph).
     */
    async search(query: string, userId: string): Promise<any[]> {
        // 1. Vector Search (Protected by Circuit Breaker)
        const queryVec = await this.embeddingCircuit.execute(async () =>
            await this.embedder.embed(query)
        );
        const vectorResults = await this.vectorCircuit.execute(async () =>
            await this.vectorDb.search(queryVec, userId, { limit: 5 })
        );

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

    /**
     * Reads the graph state for a user.
     */
    async readGraph(userId: string, limit: number = 100, offset: number = 0): Promise<any> {
        return await this.graphEngine.readGraph(userId, limit, offset);
    }

    /**
     * Researches nodes by keyword.
     */
    async searchNodes(query: string, userId: string): Promise<any> {
        return await this.graphEngine.searchNodes(query, userId);
    }

    /**
     * Generates a natural language summary of search results.
     */
    async summarize(query: string, results: any[]): Promise<string> {
        return await this.summarizer.summarize(query, results);
    }

    /**
     * Safely registers a module.
     */
    async registerModule(module: any): Promise<void> {
        await this.moduleManager.registerModule(module);
    }

    /**
     * Gets a registered module.
     */
    getModule<T>(moduleId: string): T | undefined {
        return this.moduleManager.getModule<any>(moduleId) as T | undefined;
    }
}
