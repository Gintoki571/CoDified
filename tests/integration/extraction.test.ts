// tests/integration/extraction.test.ts
import { MemoryManager } from '../../src/core/memory/MemoryManager';
import assert from 'assert';

/**
 * Integration Test: Entity Extraction
 * Tests if adding a memory correctly extracts entities and populates the graph.
 */
async function runTest() {
    console.info('🤖 Starting Entity Extraction Integration Test...');

    // Ensure we are in test mode
    process.env.NODE_ENV = 'test';

    const manager = new MemoryManager();
    const testUser = `test_user_extractor_${Date.now()}`;

    // 1. Add Memory with entities
    const content = "Alice is developing a new system using TypeScript.";
    console.info(`[Step 1] Adding Memory: "${content}" for user: ${testUser}...`);

    const memName = await manager.addMemory(content, testUser);
    console.info(`✅ Added memory node: ${memName}`);

    // 2. Read Graph
    console.info('[Step 2] Reading full graph state...');
    const graph = await manager.readGraph(testUser);

    console.info(`Graph Summary: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);

    const nodeNames = graph.nodes.map((n: any) => n.name);
    console.info('Nodes in Graph:', nodeNames);

    // 3. Verifications
    // The memory node itselt should exist
    assert.ok(nodeNames.includes(memName), 'Memory node itself should exist in the graph');

    // Extracted entities from mock (or real LLM) should exist
    // Based on our LLMProvider mock for 'test' environment:
    assert.ok(nodeNames.includes('Alice'), 'Entity "Alice" should be in graph');
    assert.ok(nodeNames.includes('TypeScript'), 'Entity "TypeScript" should be in graph');

    // Total nodes should be at least 3 (Alice, TypeScript, memory node)
    assert.ok(graph.nodes.length >= 3, `Expected at least 3 nodes, found ${graph.nodes.length}`);

    // Check edges
    console.info('Checking relationships...');
    // We expect: memory -> mentions -> Alice, memory -> mentions -> TypeScript, Alice -> uses -> TypeScript
    assert.ok(graph.edges.length >= 2, 'Graph should have extracted relationships');

    const relationshipTypes = graph.edges.map((e: any) => e.type);
    console.info('Relationship Types:', relationshipTypes);
    assert.ok(relationshipTypes.includes('mentions'), 'Relationship "mentions" should exist');

    console.info('🎉 All Entity Extraction tests passed!');
}

runTest().catch(err => {
    console.error('❌ Integration Test Failed:', err);
    process.exit(1);
});
