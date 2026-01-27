// tests/unit/run_validation_test.ts
import { validateNodeName, escapeSqlString, ValidationError } from '../../src/core/validation/index';

console.log("Starting validation security test...");

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (e: any) {
        console.log(`❌ ${name}: ${e.message}`);
    }
}

test("Allow valid name", () => {
    validateNodeName("safe_node_1");
});

test("Block SQL injection", () => {
    try {
        validateNodeName("node' OR '1'='1");
        throw new Error("Failed to block SQL injection");
    } catch (e: any) {
        if (e.name !== 'ValidationError') throw e;
    }
});

test("Block Null byte", () => {
    try {
        validateNodeName("node\x00data");
        throw new Error("Failed to block null byte");
    } catch (e: any) {
        if (e.name !== 'ValidationError') throw e;
    }
});

test("Block RLO (Unicode attack)", () => {
    try {
        validateNodeName("node\u202ereversed");
        throw new Error("Failed to block RLO");
    } catch (e: any) {
        if (e.name !== 'ValidationError') throw e;
    }
});

test("Escape SQL string", () => {
    const escaped = escapeSqlString("User's Input");
    if (escaped !== "User''s Input") throw new Error(`Wrong escape: ${escaped}`);
});

console.log("Validation security test complete.");
