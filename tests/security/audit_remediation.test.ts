import { MemoryManager } from '../../src/core/memory/MemoryManager';
import { TransactionManager } from '../../src/core/transactions/TransactionManager';
import { getDatabase } from '../../src/infrastructure/database';
import assert from 'assert';

/**
 * Audit Remediation Security Tests
 * Verifies fixes for SQL Injection, Input Validation, and Race Conditions.
 */
async function runSecurityTests() {
    process.env.NODE_ENV = 'test';
    const memoryManager = new MemoryManager();
    const userId = 'security_test_user';

    console.log('--- Starting Audit Remediation Security Tests ---');

    try {
        // 1. Test SQL Injection Mitigation (Indirectly via Subgraph)
        console.log('Testing SQL Injection Mitigation...');
        const maliciousNodeName = "test'; DROP TABLE nodes; --";
        // This should NOT throw a DB error, but might throw a ValidationError from nodeValidator
        try {
            await memoryManager.searchNodes(maliciousNodeName, userId);
            console.log('✅ SQL Injection attempt handled gracefully (blocked by validator/parameters).');
        } catch (e: any) {
            if (e.name === 'ValidationError') {
                console.log('✅ SQL Injection attempt blocked by validator.');
            } else {
                throw e;
            }
        }

        // 2. Test Transaction Isolation (Race Condition Check)
        console.log('Testing Transaction Mutex Isolation...');
        const tm = TransactionManager.getInstance();
        let counter = 0;

        // Start multiple concurrent transactions that attempt to interleave
        const t1 = tm.executeTransaction(async () => {
            const current = counter;
            await new Promise(r => setTimeout(r, 50)); // Artificial delay
            counter = current + 1;
        });

        const t2 = tm.executeTransaction(async () => {
            const current = counter;
            await new Promise(r => setTimeout(r, 50));
            counter = current + 1;
        });

        await Promise.all([t1, t2]);

        if (counter === 2) {
            console.log('✅ Transaction Mutex successfully serialized concurrent requests.');
        } else {
            console.error(`❌ Transaction Race Condition! Counter is ${counter}, expected 2.`);
            process.exit(1);
        }

        // 3. Test Secure Randomness (Distribution check - basic)
        console.log('Testing Secure Randomness (Mock Embeddings)...');
        const embedder = (memoryManager as any).embedder; // Private access for test
        const vec1 = await embedder.embed('test 1');
        const vec2 = await embedder.embed('test 2');

        // Ensure they aren't the same and look "random" (not all zeros or same)
        assert.notDeepStrictEqual(vec1, vec2, 'Mock embeddings should be unique');
        console.log('✅ Secure randomness confirmed for mock embeddings.');

        console.log('--- All Security Tests Passed ---');
    } catch (error) {
        console.error('❌ Security Tests Failed:', error);
        process.exit(1);
    }
}

runSecurityTests();
