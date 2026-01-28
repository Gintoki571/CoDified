import { getDatabase } from '../../infrastructure/database';
import { nodes, edges } from '../../infrastructure/database/schema';
import { sql, inArray } from 'drizzle-orm';
import { validateNodeName, escapeSqlString } from '../validation';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
export interface GraphNode {
    id: number;
    name: string;
    type: string | null;
    content: string | null;
    metadata?: Record<string, unknown>;
    depth: number;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: string;
    weight: number | null;
}

export interface SubgraphResult {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

// -------------------------------------------------------------------------
// Hydration Helper (Step 8 from Implementation Plan)
// -------------------------------------------------------------------------
/**
 * Converts raw SQL rows into properly typed GraphNode objects.
 * Handles JSON parsing of metadata if present.
 */
export function hydrateNodes(rawRows: any[]): GraphNode[] {
    return rawRows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type || 'concept',
        content: row.content || null,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        depth: row.depth ?? 0
    }));
}

// -------------------------------------------------------------------------
// Graph Query Engine
// -------------------------------------------------------------------------
export class GraphQueryEngine {
    /**
     * Retrieves a subgraph starting from a specific node up to a certain depth.
     * Uses Recursive Common Table Expressions (CTE) for efficient native graph traversal.
     * 
     * AUDIT FIX (CRIT-10): Uses integer ID path with comma separators to prevent
     * false positives in cycle detection (e.g., id 1 vs 11).
     * 
     * @param startNodeName - The name of the starting node (Entry Point)
     * @param userId - Context validation (Multi-tenant)
     * @param maxDepth - How many hops to traverse (Default: 2)
     */
    async findSubgraph(startNodeName: string, userId: string, maxDepth: number = 2): Promise<SubgraphResult> {
        // Input Validation & Security
        validateNodeName(startNodeName);
        if (!userId?.trim()) {
            return { nodes: [], edges: [] };
        }

        // Explicitly parameterize to ensure NO string interpolation happens in CTE logic
        const params = { name: startNodeName, userId };

        // Recursive CTE Query with proper cycle detection
        const nodeQuery = sql`
            WITH RECURSIVE traversal_path(id, name, type, content, depth, visited_ids) AS (
                -- Anchor: The Start Node
                SELECT 
                    n.id, n.name, n.type, n.content, 0 as depth, 
                    ',' || CAST(n.id AS TEXT) || ',' as visited_ids
                FROM nodes n
                WHERE n.name = ${params.name} AND n.user_id = ${params.userId}
                
                UNION ALL
                
                -- Recursive Step: Traverse outgoing edges
                SELECT 
                    target.id, target.name, target.type, target.content, tp.depth + 1,
                    tp.visited_ids || CAST(target.id AS TEXT) || ','
                FROM nodes target
                JOIN edges e ON e.target_id = target.id
                JOIN traversal_path tp ON e.source_id = tp.id
                WHERE 
                    e.user_id = ${userId} 
                    AND tp.depth < ${maxDepth}
                    -- Cycle Detection: Check if target.id is already in visited path
                    AND instr(tp.visited_ids, ',' || CAST(target.id AS TEXT) || ',') = 0
            )
            SELECT DISTINCT id, name, type, content, depth FROM traversal_path;
        `;

        const rawNodes = await getDatabase().all(nodeQuery);
        const graphNodes = hydrateNodes(rawNodes);

        if (graphNodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        // Fetch edges connecting discovered nodes
        const foundIds = graphNodes.map(n => n.id);

        const edgeQuery = sql`
            SELECT 
                src.name as source, 
                tgt.name as target, 
                e.type, 
                e.weight 
            FROM edges e
            JOIN nodes src ON e.source_id = src.id
            JOIN nodes tgt ON e.target_id = tgt.id
            WHERE 
                e.user_id = ${userId}
                AND e.source_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)})
                AND e.target_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)})
        `;

        const rawEdges = await getDatabase().all(edgeQuery);

        return {
            nodes: graphNodes,
            edges: rawEdges as GraphEdge[]
        };
    }

    /**
     * Reads a paged slice of the entire graph for a specific user.
     * Returns nodes and the edges connecting them.
     */
    async readGraph(userId: string, limit: number = 100, offset: number = 0): Promise<SubgraphResult> {
        if (!userId?.trim()) return { nodes: [], edges: [] };

        // 1. Fetch paged nodes (Securely Parameterized)
        const nodeQuery = sql`
            SELECT id, name, type, content, 0 as depth
            FROM nodes
            WHERE user_id = ${userId}
            LIMIT ${Number(limit)} OFFSET ${Number(offset)}
        `;

        const rawNodes = await getDatabase().all(nodeQuery);
        const graphNodes = hydrateNodes(rawNodes);

        if (graphNodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        // 2. Fetch edges connecting these nodes
        const foundIds = graphNodes.map(n => n.id);
        const edgeQuery = sql`
            SELECT 
                src.name as source, 
                tgt.name as target, 
                e.type, 
                e.weight 
            FROM edges e
            JOIN nodes src ON e.source_id = src.id
            JOIN nodes tgt ON e.target_id = tgt.id
            WHERE 
                e.user_id = ${userId}
                AND (e.source_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)})
                OR e.target_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)}))
        `;

        const rawEdges = await getDatabase().all(edgeQuery);

        return {
            nodes: graphNodes,
            edges: rawEdges as GraphEdge[]
        };
    }

    /**
     * Searches nodes by keyword matching in name, content, or type.
     */
    async searchNodes(query: string, userId: string): Promise<SubgraphResult> {
        if (!userId?.trim() || !query?.trim()) return { nodes: [], edges: [] };

        const safeQuery = `%${query}%`;
        const nodeQuery = sql`
            SELECT id, name, type, content, 0 as depth
            FROM nodes
            WHERE user_id = ${userId}
              AND (name LIKE ${safeQuery} OR content LIKE ${safeQuery} OR type LIKE ${safeQuery})
            LIMIT 50
        `;

        const rawNodes = await getDatabase().all(nodeQuery);
        const graphNodes = hydrateNodes(rawNodes);

        if (graphNodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        // Fetch edges between these nodes for context
        const foundIds = graphNodes.map(n => n.id);
        const edgeQuery = sql`
            SELECT 
                src.name as source, 
                tgt.name as target, 
                e.type, 
                e.weight 
            FROM edges e
            JOIN nodes src ON e.source_id = src.id
            JOIN nodes tgt ON e.target_id = tgt.id
            WHERE 
                e.user_id = ${userId}
                AND (e.source_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)})
                OR e.target_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)}))
        `;

        const rawEdges = await getDatabase().all(edgeQuery);

        return {
            nodes: graphNodes,
            edges: rawEdges as GraphEdge[]
        };
    }

    /**
     * Finds the shortest path between two nodes using BFS.
     * Useful for checking "How is X related to Y?"
     * 
     * @returns The path as a string (e.g., "A->B->C") or null if no path exists
     */
    async findPath(
        startNode: string,
        endNode: string,
        userId: string,
        maxDepth: number = 5
    ): Promise<{ path: string; depth: number } | null> {
        // Input Validation & Security
        validateNodeName(startNode);
        validateNodeName(endNode);
        if (!userId?.trim()) {
            return null;
        }

        // Early exit: Same node
        if (startNode === endNode) {
            return { path: startNode, depth: 0 };
        }

        const query = sql`
            WITH RECURSIVE path_finding(id, name, path_names, depth, found) AS (
                -- Anchor
                SELECT 
                    n.id, 
                    n.name, 
                    n.name as path_names, 
                    0, 
                    CASE WHEN n.name = ${endNode} THEN 1 ELSE 0 END as found
                FROM nodes n
                WHERE n.name = ${startNode} AND n.user_id = ${userId}
                
                UNION ALL
                
                -- Recursive expansion
                SELECT 
                    tgt.id, 
                    tgt.name, 
                    pf.path_names || ' -> ' || tgt.name, 
                    pf.depth + 1,
                    CASE WHEN tgt.name = ${endNode} THEN 1 ELSE 0 END
                FROM nodes tgt
                JOIN edges e ON e.target_id = tgt.id
                JOIN path_finding pf ON e.source_id = pf.id
                WHERE 
                    e.user_id = ${userId}
                    AND pf.depth < ${maxDepth}
                    AND pf.found = 0
                    -- Cycle prevention using substring check
                    AND instr(pf.path_names, tgt.name) = 0
            )
            SELECT path_names as path, depth 
            FROM path_finding 
            WHERE found = 1 
            ORDER BY depth ASC 
            LIMIT 1;
        `;

        const result = await getDatabase().get(query) as { path: string; depth: number } | undefined;
        return result || null;
    }

    /**
     * Gets direct neighbors of a node (1-hop).
     * Faster than findSubgraph for simple lookups.
     */
    /**
     * Bidirectional recursive context discovery.
     * Follows both outgoing and incoming edges to find the full semantic harbor of a node.
     */
    async findDeepContext(startNodeName: string, userId: string, maxDepth: number = 2): Promise<SubgraphResult> {
        validateNodeName(startNodeName);
        if (!userId?.trim()) return { nodes: [], edges: [] };

        const query = sql`
            WITH RECURSIVE deep_traversal(id, name, type, content, depth, visited_ids) AS (
                -- Anchor
                SELECT n.id, n.name, n.type, n.content, 0, ',' || CAST(n.id AS TEXT) || ','
                FROM nodes n
                WHERE n.name = ${startNodeName} AND n.user_id = ${userId}

                UNION ALL

                -- Bidirectional Step
                SELECT target.id, target.name, target.type, target.content, dt.depth + 1,
                       dt.visited_ids || CAST(target.id AS TEXT) || ','
                FROM nodes target
                JOIN edges e ON (e.target_id = target.id OR e.source_id = target.id)
                JOIN deep_traversal dt ON (e.source_id = dt.id OR e.target_id = dt.id)
                WHERE e.user_id = ${userId}
                  AND dt.depth < ${maxDepth}
                  AND instr(dt.visited_ids, ',' || CAST(target.id AS TEXT) || ',') = 0
            )
            SELECT DISTINCT id, name, type, content, depth FROM deep_traversal;
        `;

        const rawNodes = await getDatabase().all(query);
        const graphNodes = hydrateNodes(rawNodes);

        if (graphNodes.length === 0) return { nodes: [], edges: [] };

        const foundIds = graphNodes.map(n => n.id);
        const edgeQuery = sql`
            SELECT src.name as source, tgt.name as target, e.type, e.weight 
            FROM edges e
            JOIN nodes src ON e.source_id = src.id
            JOIN nodes tgt ON e.target_id = tgt.id
            WHERE e.user_id = ${userId}
              AND e.source_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)})
              AND e.target_id IN (${sql.join(foundIds.map(id => sql`${id}`), sql`, `)})
        `;

        const rawEdges = await getDatabase().all(edgeQuery);

        return {
            nodes: graphNodes,
            edges: rawEdges as GraphEdge[]
        };
    }
}
