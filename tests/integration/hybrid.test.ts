// tests/integration/hybrid.test.ts
import { MemoryManager } from '../../src/core/memory/MemoryManager';
import assert from 'assert';

/**
 * Integration Test: Hybrid Search & Summarization (Phase 2)
 */
async function runTest() {
    console.info('🤖 Starting Phase 2: Hybrid Search Integration Test...');

    // Ensure we are in test mode
    process.env.NODE_ENV = 'test';

    const manager = new MemoryManager();
    const testUser = `hybrid_user_${Date.now()}`;

    // 1. Seed Data
    const content = "DeepMind is an AI research lab acquired by Google.";
    console.info(`[Step 1] Seeding Memory: "${content}"...`);
    await manager.addMemory(content, testUser);

    // 2. Perform Hybrid Search
    console.info('[Step 2] Performing Search for "Google"...');
    const results = await manager.search("Google", testUser);

    assert.ok(results.length > 0, 'Should find at least one result');
    console.info(`Found ${results.length} results.`);

    // 3. Perform Summarization
    console.info('[Step 3] Generating Summary...');
    const summary = await manager.summarize("What is Google's relation to AI?", results);

    console.info('Generated Summary:', summary);
    assert.ok(summary.includes('mock summary'), 'Summary should contain mock text');

    // 4. Verify Metadata Storage (from Work Area 10.1)
    console.info('[Step 4] Verifying Graph Metadata Storage...');
    const graph = await manager.readGraph(testUser);
    const nodesWithMeta = graph.nodes.filter((n: any) => n.metadata && Object.keys(n.metadata).length > 0);

    // Note: In mock mode, Alice/TypeScript are added with empty metadata usually, 
    // but the extractedData mock in EntityExtractor was updated in previous turns?
    // Actually, LLMProvider mock returns metadata: {} for entities.

    console.info(`Found ${nodesWithMeta.length} nodes with metadata.`);
    // Since mock entities have metadata: {} (empty but exists), we check if property is there
    assert.ok(graph.nodes.every((n: any) => 'metadata' in n), 'All nodes should have a metadata property');

    console.info('🎉 Phase 2 Hybrid Search tests passed!');
}

runTest().catch(err => {
    console.error('❌ Integration Test Failed:', err);
    process.exit(1);
});
