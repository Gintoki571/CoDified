// tests/unit/rate_limit.test.ts
import { RateLimiter } from '../../src/core/security/RateLimiter';
import { CONFIG } from '../../src/config/config';

console.log("Starting Rate Limiter test...");

const limiter = RateLimiter.getInstance();
const testUser = "test_user_123";

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (e: any) {
        console.log(`❌ ${name}: ${e.message}`);
    }
}

test("Allow requests within limit", () => {
    // Reset or use fresh user
    for (let i = 0; i < 5; i++) {
        if (!limiter.consume(testUser)) throw new Error(`Request ${i} blocked unexpectedly`);
    }
});

test("Block requests exceeding limit", () => {
    const max = CONFIG.RATE_LIMIT.MAX_REQUESTS;
    const user2 = "overflow_user";

    // Fill up
    for (let i = 0; i < max; i++) {
        limiter.consume(user2);
    }

    // One more should fail
    if (limiter.consume(user2)) {
        throw new Error("Request allowed despite exceeding limit");
    }
});

console.log("Rate Limiter test complete.");
