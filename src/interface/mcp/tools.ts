import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryManager } from '../../core/memory/MemoryManager';
import { RememError, ErrorFactory } from '../../core/errors';
import { RateLimiter } from '../../core/security/RateLimiter';
import { Logger } from '../../core/logging/Logger';
import { z } from 'zod';

// -------------------------------------------------------------------------
// Validation Schemas
// -------------------------------------------------------------------------
const MemoryContentSchema = z.string().min(1).max(50000); // 50k chars max
const UserIdSchema = z.string().min(1).max(100);
const QuerySchema = z.string().min(1).max(1000);

const AddMemorySchema = z.object({
    text: MemoryContentSchema,
    metadata: z.string().optional(),
    userId: UserIdSchema.optional().default('default_user')
});

const SearchMemorySchema = z.object({
    query: QuerySchema,
    userId: UserIdSchema.optional().default('default_user')
});

const ReadGraphSchema = z.object({
    limit: z.number().int().min(1).max(500).optional().default(100),
    offset: z.number().int().min(0).optional().default(0),
    userId: UserIdSchema.optional().default('default_user')
});

const SearchNodesSchema = z.object({
    query: QuerySchema,
    userId: UserIdSchema.optional().default('default_user')
});

const HybridSearchSchema = z.object({
    query: QuerySchema,
    userId: UserIdSchema.optional().default('default_user'),
    depth: z.number().int().min(1).max(3).optional().default(1)
});

// Initialize Managers
const memoryManager = new MemoryManager();
const rateLimiter = RateLimiter.getInstance();

// Create MCP Server with explicit capabilities
const server = new Server(
    {
        name: "CoDified-Engine",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Tool definitions
const toolDefinitions = [
    {
        name: "add_memory",
        description: "Store a memory with optional metadata",
        inputSchema: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The content of the memory to store"
                },
                metadata: {
                    type: "string",
                    description: "JSON string of extra metadata",
                    optional: true
                },
                userId: {
                    type: "string",
                    description: "The user ID to associate memory with",
                    default: "default_user"
                }
            },
            required: ["text"]
        }
    },
    {
        name: "search_memory",
        description: "Search memories using semantic similarity",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The semantic query to search for"
                },
                userId: {
                    type: "string",
                    description: "The user ID to filter memories",
                    default: "default_user"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "read_graph",
        description: "Read a paged slice of the entire knowledge graph",
        inputSchema: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Max nodes to return", default: 100 },
                offset: { type: "number", description: "Offset for paging", default: 0 },
                userId: { type: "string", description: "User ID filter", default: "default_user" }
            }
        }
    },
    {
        name: "search_nodes",
        description: "Search for specific nodes by keyword (name, content, or type)",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Keyword to search for" },
                userId: { type: "string", description: "User ID filter", default: "default_user" }
            },
            required: ["query"]
        }
    },
    {
        name: "hybrid_search",
        description: "Advanced search combining semantic vector lookup, graph expansion, and LLM summarization",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The complex question or topic to research" },
                userId: { type: "string", description: "User ID filter", default: "default_user" },
                depth: { type: "number", description: "Graph traversal depth (1-3)", default: 1 }
            },
            required: ["query"]
        }
    }
];

// Handle ListToolsRequest
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: toolDefinitions.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }))
    };
});

// Handle CallToolRequest
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Security: Rate Limit Check
    const userId = (args?.userId as string) || 'default_user';
    if (!rateLimiter.consume(userId)) {
        throw ErrorFactory.validation('Rate limit exceeded', {
            code: 'RATE_LIMIT_EXCEEDED',
            suggestion: 'Please wait a minute before sending more requests'
        });
    }

    try {
        if (name === "add_memory") {
            const validated = AddMemorySchema.parse(args);
            const { text, metadata } = validated;
            const targetUserId = validated.userId || 'default_user';

            const meta = metadata ? JSON.parse(metadata) : {};
            const memoryName = await memoryManager.addMemory(text, targetUserId, meta);

            return {
                content: [
                    {
                        type: "text",
                        text: `Memory stored successfully: ${memoryName}`
                    }
                ]
            };
        } else if (name === "search_memory") {
            const validated = SearchMemorySchema.parse(args);
            const { query } = validated;
            const targetUserId = validated.userId || 'default_user';

            const results = await memoryManager.search(query, targetUserId);

            // Format results for LLM consumption
            const readable = results.map(r => {
                const graphCtx = r.context
                    ? `[Graph: ${r.context.nodes.length} nodes, ${r.context.edges.length} edges]`
                    : '[No Graph Context]';
                const content = r.memory.content || r.memory.text || 'No content';
                return `Memory: "${content}"\n  Similarity: ${r.similarity}\n  Context: ${graphCtx}`;
            }).join('\n---\n');

            return {
                content: [
                    {
                        type: "text",
                        text: readable || 'No memories found.'
                    }
                ]
            };
        } else if (name === "read_graph") {
            const validated = ReadGraphSchema.parse(args);
            const { limit, offset } = validated;
            const targetUserId = validated.userId || 'default_user';

            const result = await memoryManager.readGraph(targetUserId, limit, offset);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        } else if (name === "search_nodes") {
            const validated = SearchNodesSchema.parse(args);
            const { query } = validated;
            const targetUserId = validated.userId || 'default_user';

            const result = await memoryManager.searchNodes(query, targetUserId);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        } else if (name === "hybrid_search") {
            const validated = HybridSearchSchema.parse(args);
            const { query, depth } = validated;
            const targetUserId = validated.userId || 'default_user';

            const results = await memoryManager.search(query, targetUserId);
            const summary = await memoryManager.summarize(query, results);

            return {
                content: [
                    {
                        type: "text",
                        text: `### Summary\n${summary}\n\n### Supporting Context\n` + results.map(r => {
                            const content = r.memory.content || 'No content';
                            return `- ${content}`;
                        }).join('\n')
                    }
                ]
            };
        } else {
            throw ErrorFactory.validation(`Unknown tool: ${name}`);
        }
    } catch (err: unknown) {
        if (err instanceof z.ZodError) {
            const issues = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
            throw new Error(`Validation Error: ${issues}`);
        }
        const message = err instanceof RememError ? err.toUserFriendly() :
            (err instanceof Error ? err.message : String(err));
        throw new Error(`Error executing tool ${name}: ${message}`);
    }
});

// Error handling
server.onerror = (error: Error) => {
    Logger.error('MCP', "[MCP Server Error]", error);
};

// Graceful Shutdown
const cleanup = async () => {
    Logger.info('MCP', '[CoDified] Shutting down gracefully...');
    await server.close();
    process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start Server
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        Logger.info('MCP', "CoDified MCP Server running on stdio");
    } catch (error) {
        Logger.error('MCP', "Fatal Server Error:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    Logger.error('MCP', "Fatal error in main():", error);
    process.exit(1);
});
