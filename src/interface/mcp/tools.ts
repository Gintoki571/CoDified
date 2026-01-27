import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MemoryManager } from '../../core/memory/MemoryManager';

// Initialize Manager
const memoryManager = new MemoryManager();

// Create MCP Server
const server = new McpServer({
    name: "ReMem-Engine",
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
    async ({ text, metadata, userId }) => {
        try {
            const meta = metadata ? JSON.parse(metadata) : {};
            const name = await memoryManager.addMemory(text, userId, meta);
            return {
                content: [{ type: "text", text: `Memory stored successfully: ${name}` }]
            };
        } catch (err: any) {
            return {
                content: [{ type: "text", text: `Error storing memory: ${err.message}` }],
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
    async ({ query, userId }) => {
        try {
            const results = await memoryManager.search(query, userId);

            // Format results for LLM consumption
            const readable = results.map(r => {
                const graphCtx = r.context ?
                    `[Graph: ${r.context.nodes.length} nodes, ${r.context.edges.length} edges]` :
                    '[No Graph Context]';
                return \`Memory: "\${r.memory.content || r.memory.text}"\n  Similarity: \${r.similarity}\n  Context: \${graphCtx}\`;
            }).join('\n---\n');

            return {
                content: [{ type: "text", text: readable }]
            };
        } catch (err: any) {
            return {
                content: [{ type: "text", text: `Error searching memory: ${ err.message } ` }],
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
