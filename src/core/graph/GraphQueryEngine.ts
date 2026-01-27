import { db } from '../../infrastructure/database';
import { nodes, edges } from '../../infrastructure/database/schema';
import { sql } from 'drizzle-orm';

export interface GraphNode {
    id: number;
    name: string;
    type: string;
    content: string | null;
    depth: number;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: string;
    weight: number;
}

export class GraphQueryEngine {
    /**
     * Retrieves a subgraph starting from a specific node up to a certain depth.
     * Uses Recursive Common Table Expressions (CTE) for efficient native graph traversal.
     * 
     * @param startNodeName - The name of the starting node (Entry Point)
     * @param userId - Context validation (Multi-tenant)
     * @param maxDepth - How many hops to traverse (Default: 2)
     */
    async findSubgraph(startNodeName: string, userId: string, maxDepth: number = 2): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
        // Validation per audit requirement
        if (!startNodeName || !userId) return { nodes: [], edges: [] };

        // Recursive CTE Query
        // 1. Anchor Member: Select the start node
        // 2. Recursive Member: Join edges where source is previous node
        // 3. Cycle Detection: Check if target ID is already in the visited path
        const query = sql`
            WITH RECURSIVE traversal_path(id, name, type, content, depth, visited_ids) AS (
                -- Anchor: The Start Node
                SELECT 
                    n.id, n.name, n.type, n.content, 0 as depth, 
                    ',' || n.id || ',' as visited_ids
                FROM nodes n
                WHERE n.name = ${startNodeName} AND n.user_id = ${userId}
                
                UNION ALL
                
                -- Recursive Step
                SELECT 
                    target.id, target.name, target.type, target.content, tp.depth + 1,
                    tp.visited_ids || target.id || ','
                FROM nodes target
                JOIN edges e ON e.target_id = target.id
                JOIN traversal_path tp ON e.source_id = tp.id
                WHERE 
                    e.user_id = ${userId} 
                    AND tp.depth < ${maxDepth}
                    -- Cycle Detection: Verify target.id is not in visited_ids string
                    AND instr(tp.visited_ids, ',' || target.id || ',') = 0
            )
            SELECT DISTINCT * FROM traversal_path;
        `;

        const nodeResults = await db.all(query) as GraphNode[];

        if (nodeResults.length === 0) return { nodes: [], edges: [] };

        // Fetch Edges connecting these nodes
        // This is a separate optimized query to get the connections between the found set
        const nodeNames = nodeResults.map(n => n.name);
        if (nodeNames.length === 0) return { nodes: nodeResults, edges: [] };

        const edgeQuery = await db.select({
            source: sql<string>`src.name`,
            target: sql<string>`tgt.name`,
            type: edges.type,
            weight: edges.weight
        })
            .from(edges)
            .innerJoin(nodes, sql`${edges.sourceId} = ${nodes}.id`).as('src') // Alias handling in raw SQL might be safer here or via defines
        // Simplification: Let's use Drizzle's query builder for the Edges part as it's non-recursive
        // Wait, Drizzle aliases are tricky. Let's stick to strict raw SQL for the edges to ensure correctness with the IDs we found.

        // Re-write Edge Query safely
        const foundIds = nodeResults.map(n => n.id);
        // We need edges where BOTH source and target are in the found set
        const edgesRaw = await db.all(sql`
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
                AND e.source_id IN ${foundIds}
                AND e.target_id IN ${foundIds}
        `);

        return {
            nodes: nodeResults,
            edges: edgesRaw as GraphEdge[]
        };
    }

    /**
     * Finds the shortest path between two nodes using BFS.
     * Useful for checking "How is X related to Y?"
     */
    async findPath(startNode: string, endNode: string, userId: string, maxDepth: number = 4) {
        // Bidirectional search or simple BFS CTE
        // Using simple BFS CTE for now
        const query = sql`
            WITH RECURSIVE path_finding(id, name, path_names, depth, found) AS (
                SELECT 
                    n.id, n.name, n.name, 0, (n.name = ${endNode})
                FROM nodes n
                WHERE n.name = ${startNode} AND n.user_id = ${userId}
                
                UNION ALL
                
                SELECT 
                    tgt.id, tgt.name, pf.path_names || '->' || tgt.name, pf.depth + 1, (tgt.name = ${endNode})
                FROM nodes tgt
                JOIN edges e ON e.target_id = tgt.id
                JOIN path_finding pf ON e.source_id = pf.id
                WHERE 
                    e.user_id = ${userId}
                    AND pf.depth < ${maxDepth}
                    AND pf.found = 0 -- Stop expanding if we found logic already (handled by limit usually)
                    AND instr(pf.path_names, tgt.name) = 0 -- Cycle verification
            )
            SELECT * FROM path_finding WHERE name = ${endNode} ORDER BY depth ASC LIMIT 1;
        `;

        return await db.get(query);
    }
}
