/* eslint-disable no-console */
/**
 * MCP Server Launcher for CoDified
 * Ensures no stdout pollution by hijacking console.log/info
 * and redirecting all non-JSON-RPC output to stderr.
 */

// 1. Monkey-patch stdout to protect the JSON-RPC stream
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function (chunk, encoding, callback) {
    const str = chunk.toString();
    // Valid JSON-RPC messages start with { and contain "jsonrpc"
    if (str.includes('"jsonrpc"') && str.startsWith('{')) {
        return originalStdoutWrite(chunk, encoding, callback);
    }
    // Everything else goes to stderr
    return process.stderr.write(chunk, encoding, callback);
};

// 2. Redirect high-level console calls to stderr
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);
console.warn = (...args) => console.error(...args);

// 3. Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 4. Use tsx/cjs loader and run the server
// This approach uses child_process to spawn tsx correctly
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.resolve(__dirname, 'src/interface/mcp/tools.ts');
const tsxPath = path.resolve(__dirname, 'node_modules/.bin/tsx');

const child = spawn(tsxPath, [serverPath], {
    stdio: ['inherit', 'pipe', 'inherit'],
    env: { ...process.env },
    shell: true
});

// Pipe child stdout through our filter
child.stdout.on('data', (data) => {
    const str = data.toString();
    if (str.includes('"jsonrpc"') && str.startsWith('{')) {
        originalStdoutWrite(data);
    } else {
        process.stderr.write(data);
    }
});

child.on('error', (err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
});

child.on('close', (code) => {
    process.exit(code || 0);
});
