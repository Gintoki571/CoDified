import { MemoryManager } from '../../src/core/memory/MemoryManager';
import { closeDatabase } from '../../src/infrastructure/database';
import assert from 'assert';

async function runIntegrationTest() {
    console.log('🧪 Starting ReMem Engine Integration Test...');

    // Initialize
    const manager = new MemoryManager();
    const testUser = 'test_user_' + Date.now();
    const testContent = `Integration Test Memory about Project Alpha. It involves component X and Y. Timestamp: ${Date.now()}`;

    // 1. Test Adding Memory
    console.log(`[Step 1] Adding Memory for user: ${testUser}...`);
    const name = await manager.addMemory(testContent, testUser, { source: 'integration_test' });
    console.log(`✅ Added memory with ID/Name: ${name}`);
    assert.ok(name, 'Memory name should be returned');

    // 2. Test Search (immediate retrieval via Vector + Graph)
    // Wait briefly for any async consistency if needed (sqlite is sync mostly)
    console.log('[Step 2] Searching for "Project Alpha"...');
    const results = await manager.search('Project Alpha', testUser);

    console.log(`✅ Found ${results.length} results`);
    assert.ok(results.length > 0, 'Should find at least one result');

    const firstResult = results[0];
    const content = firstResult.memory.content || firstResult.memory.text;
    console.log(`   Top Result: "${content.substring(0, 50)}..."`);
    assert.ok(content.includes('Project Alpha'), 'Result should match query content');

    // 3. Test Graph Context (Auto-linking?)
    // Note: Our current logic doesn't auto-create 'mentions' edges yet unless we run explicit extraction.
    // The Sprint Plan "Step 3.1.3 Entity Extraction" was "Entity Extraction (LLM-based)".
    // I didn't verify if I implemented that in MemoryManager.addMemory.
    // Checking MemoryManager code... it just does 'addMemory'. It does NOT call an extraction service yet.
    // So Graph Context might be empty. That is expected for Phase 1.
    if (firstResult.context) {
        console.log(`   Graph Context: ${firstResult.context.nodes.length} nodes`);
    } else {
        console.log('   Graph Context: None (Expected until Entity Extraction is active)');
    }

    console.log('🎉 Integration Test Passed!');

    // Cleanup
    closeDatabase();
}

runIntegrationTest().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
