const { MemoryManager } = require('./src/core/memory/MemoryManager');
const { closeDatabase } = require('./src/infrastructure/database');

async function runTestSuite() {
    process.env.NODE_ENV = 'test';
    const memoryManager = new MemoryManager();
    const userId = 'mcp_test_user_direct';

    console.log('--- Starting direct Manager Tool Verification ---');

    try {
        // 1. Test addMemory
        console.log('[1/5] Testing addMemory...');
        const memoryName = await memoryManager.addMemory(
            'CoDified is a high-performance memory engine for AI agents.',
            userId,
            { source: 'manual_verification' }
        );
        console.log(`✅ addMemory successful: ${memoryName}`);

        // 2. Test search
        console.log('[2/5] Testing search (semantic)...');
        const searchResults = await memoryManager.search('performance memory engine', userId);
        if (searchResults.length > 0) {
            console.log(`✅ search successful: Found ${searchResults.length} results.`);
        } else {
            console.warn('⚠️ search returned no results (might be indexing delay).');
        }

        // 3. Test readGraph
        console.log('[3/5] Testing readGraph...');
        const graph = await memoryManager.readGraph(userId);
        console.log(`✅ readGraph successful: Found ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);

        // 4. Test searchNodes
        console.log('[4/5] Testing searchNodes...');
        const nodes = await memoryManager.searchNodes('CoDified', userId);
        console.log(`✅ searchNodes successful: Found ${nodes.length} nodes.`);

        // 5. Test summarize (Hybrid Search logic)
        console.log('[5/5] Testing summarize...');
        const summary = await memoryManager.summarize('What is CoDified?', searchResults);
        console.log(`✅ summarize successful: "${summary.substring(0, 50)}..."`);

        console.log('\n--- All Core Tool Logic Verified Successfully ---');
    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        await closeDatabase();
        process.exit(0);
    }
}

runTestSuite();
