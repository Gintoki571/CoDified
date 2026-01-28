import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryManager } from '../../core/memory/MemoryManager';
import { RememError, ErrorFactory } from '../../core/errors';
import { RateLimiter } from '../../core/security/RateLimiter';

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
            const text = args?.text as string;
            const metadata = args?.metadata as string | undefined;
            
            if (!text) {
                throw ErrorFactory.validation('Missing required parameter: text');
            }

            const meta = metadata ? JSON.parse(metadata) : {};
            const memoryName = await memoryManager.addMemory(text, userId, meta);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Memory stored successfully: ${memoryName}`
                    }
                ]
            };
        } else if (name === "search_memory") {
            const query = args?.query as string;
            
            if (!query) {
                throw ErrorFactory.validation('Missing required parameter: query');
            }

            const results = await memoryManager.search(query, userId);

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
        } else {
            throw ErrorFactory.validation(`Unknown tool: ${name}`);
        }
    } catch (err: unknown) {
        const message = err instanceof RememError ? err.toUserFriendly() :
            (err instanceof Error ? err.message : String(err));
        throw new Error(`Error executing tool ${name}: ${message}`);
    }
});

// Error handling
server.onerror = (error: Error) => {
    console.error("[MCP Server Error]", error);
};

// Graceful Shutdown
const cleanup = async () => {
    console.error('[CoDified] Shutting down gracefully...');
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
        console.error("CoDified MCP Server running on stdio");
    } catch (error) {
        console.error("Fatal Server Error:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
