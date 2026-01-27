import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MemoryManager } from '../../core/memory/MemoryManager';
import { RememError, ErrorFactory } from '../../core/errors';
import { RateLimiter } from '../../core/security/RateLimiter';

// Initialize Managers
const memoryManager = new MemoryManager();
const rateLimiter = RateLimiter.getInstance();

// Create MCP Server
const server = new McpServer({
    name: "CoDified-Engine",
    version: "1.0.0"
});

// -------------------------------------------------------------------------
// Tool: add_memory
// -------------------------------------------------------------------------
server.tool(
    "add_memory",
    {
        text: z.string().describe("The content of the memory to store"),
        metadata: z.string().optional().describe("JSON string of extra metadata"),
        userId: z.string().default("default_user").describe("The user ID to associate memory with")
    },
    async (args: { text: string; metadata?: string; userId: string }) => {
        try {
            // Security: Rate Limit Check
            if (!rateLimiter.consume(args.userId)) {
                throw ErrorFactory.validation('Rate limit exceeded', {
                    code: 'RATE_LIMIT_EXCEEDED',
                    suggestion: 'Please wait a minute before sending more requests'
                });
            }

            const meta = args.metadata ? JSON.parse(args.metadata) : {};
            const name = await memoryManager.addMemory(args.text, args.userId, meta);
            return {
                content: [{ type: "text" as const, text: `Memory stored successfully: ${name}` }]
            };
        } catch (err: unknown) {
            const message = err instanceof RememError ? err.toUserFriendly() :
                (err instanceof Error ? err.message : String(err));
            return {
                content: [{ type: "text" as const, text: `Error storing memory: ${message}` }],
                isError: true
            };
        }
    }
);

// -------------------------------------------------------------------------
// Tool: search_memory
// -------------------------------------------------------------------------
server.tool(
    "search_memory",
    {
        query: z.string().describe("The semantic query to search for"),
        userId: z.string().default("default_user")
    },
    async (args: { query: string; userId: string }) => {
        try {
            // Security: Rate Limit Check
            if (!rateLimiter.consume(args.userId)) {
                throw ErrorFactory.validation('Rate limit exceeded', {
                    code: 'RATE_LIMIT_EXCEEDED',
                    suggestion: 'Please wait a minute before sending more requests'
                });
            }

            const results = await memoryManager.search(args.query, args.userId);

            // Format results for LLM consumption
            const readable = results.map(r => {
                const graphCtx = r.context
                    ? `[Graph: ${r.context.nodes.length} nodes, ${r.context.edges.length} edges]`
                    : '[No Graph Context]';
                const content = r.memory.content || r.memory.text || 'No content';
                return `Memory: "${content}"\n  Similarity: ${r.similarity}\n  Context: ${graphCtx}`;
            }).join('\n---\n');

            return {
                content: [{ type: "text" as const, text: readable || 'No memories found.' }]
            };
        } catch (err: unknown) {
            const message = err instanceof RememError ? err.toUserFriendly() :
                (err instanceof Error ? err.message : String(err));
            return {
                content: [{ type: "text" as const, text: `Error searching memory: ${message}` }],
                isError: true
            };
        }
    }
);


// Start Server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ReMem Engine MCP Server running on Stdio");
}

main().catch((error) => {
    console.error("Fatal Server Error:", error);
    process.exit(1);
});
