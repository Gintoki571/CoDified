import { sqliteTable, text, integer, real, uniqueIndex, index, AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql, Relations } from 'drizzle-orm';

// -------------------------------------------------------------------------
// 1. Nodes Table (The "Memory" Entities)
// -------------------------------------------------------------------------
export const nodes = sqliteTable('nodes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type').default('concept'),  // e.g., 'concept', 'entity', 'event'
    content: text('content'),               // Raw text content
    userId: text('user_id').notNull(),      // Multi-tenant isolation
    embeddingId: text('embedding_id'),      // Link to LanceDB (optional)
    metadata: text('metadata', { mode: 'json' }), // Flexible metadata
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    status: text('status').default('PENDING'), // PENDING, READY, FAILED
}, (t) => ({
    // Strict Composite Unique: A user cannot have two nodes with the same name
    uniqueNameUser: uniqueIndex('uid_nodes_name_user').on(t.name, t.userId),
    // Temporal Index for fast Time-Window queries
    createdAtIndex: index('idx_nodes_created').on(t.createdAt),
    // Performance Index for User lookups
    userIdIndex: index('idx_nodes_user').on(t.userId),
}));

// -------------------------------------------------------------------------
// 2. Edges Table (Relationships)
// -------------------------------------------------------------------------
export const edges = sqliteTable('edges', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Foreign Keys to Nodes (using ID for strict referential integrity)
    sourceId: integer('source_id')
        .notNull()
        .references(() => nodes.id, { onDelete: 'cascade' }),
    targetId: integer('target_id')
        .notNull()
        .references(() => nodes.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('RELATED_TO'),
    weight: real('weight').default(1.0),
    userId: text('user_id').notNull(),
    metadata: text('metadata', { mode: 'json' }), // Relationship metadata
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
}, (t) => ({
    // Performance Indices for Graph Traversal
    sourceIndex: index('idx_edges_source').on(t.sourceId),
    targetIndex: index('idx_edges_target').on(t.targetId),
    userIndex: index('idx_edges_user').on(t.userId),
}));

// -------------------------------------------------------------------------
// 3. Memory Events (Audit Trail / Event Sourcing)
// -------------------------------------------------------------------------
export const memoryEvents = sqliteTable('memory_events', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(), // 'MEMORY_ADDED', 'GRAPH_LINKED', etc.
    description: text('description'),
    metadata: text('metadata', { mode: 'json' }), // Flexible JSON payload
    userId: text('user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
}, (t) => ({
    createdIndex: index('idx_events_created').on(t.createdAt),
}));

// -------------------------------------------------------------------------
// 4. Embeddings Metadata (Optional, if we want SQL tracking of vectors)
// -------------------------------------------------------------------------
export const embeddings = sqliteTable('embeddings', {
    id: text('id').primaryKey(), // Using UUID matching LanceDB
    nodeId: integer('node_id')
        .references(() => nodes.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    model: text('model').notNull(), // e.g. 'all-MiniLM-L6-v2'
    createdAt: integer('created_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`),
});
// -------------------------------------------------------------------------
// 5. Messages Table (Chat History)
// -------------------------------------------------------------------------
export const messages = sqliteTable('messages', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    role: text('role').notNull(), // 'user', 'assistant', 'system'
    content: text('content').notNull(),
    tokenCount: integer('token_count'),
    isSummarized: integer('is_summarized').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
}, (t) => ({
    summarizedIndex: index('idx_messages_summarized').on(t.isSummarized),
    createdIndex: index('idx_messages_created').on(t.createdAt),
}));

// -------------------------------------------------------------------------
// 6. Agents Table (Persona / Scope Management)
// -------------------------------------------------------------------------
export const agents = sqliteTable('agents', {
    id: text('id').primaryKey(), // e.g., 'coding-assistant'
    name: text('name').notNull(),
    type: text('type').notNull(),
    capabilities: text('capabilities', { mode: 'json' }),
    userId: text('user_id'), // Nullable if system-wide
    createdAt: integer('created_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`),
    lastSeen: integer('last_seen', { mode: 'timestamp' })
        .default(sql`(unixepoch())`),
});
