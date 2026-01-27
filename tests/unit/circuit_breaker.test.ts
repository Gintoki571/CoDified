// tests/unit/circuit_breaker.test.ts
import { CircuitBreaker, CircuitState } from '../../src/core/security/CircuitBreaker';

console.log("Starting Circuit Breaker test...");

const cb = new CircuitBreaker("TestCircuit", { failureThreshold: 2, resetTimeoutMs: 1000 });

async function test_cb() {
    try {
        console.log("Status: " + CircuitState[cb.getState()]);

        // Fail 1
        try { await cb.execute(async () => { throw new Error("Fail 1"); }); } catch (e) { }
        console.log("Status after 1 fail: " + CircuitState[cb.getState()]);

        // Fail 2 -> OPEN
        try { await cb.execute(async () => { throw new Error("Fail 2"); }); } catch (e) { }
        console.log("Status after 2 fails: " + CircuitState[cb.getState()]);

        // Should be rejected immediately
        try {
            await cb.execute(async () => { return "ok"; });
            console.log("❌ Error: Request allowed while OPEN");
        } catch (e) {
            console.log("✅ Blocked while OPEN: " + e.message);
        }

        // Wait for timeout
        console.log("Waiting for reset timeout...");
        await new Promise(r => setTimeout(r, 1100));

        // Attempt -> HALF_OPEN
        console.log("State before recovery attempt: " + CircuitState[cb.getState()]);
        const res = await cb.execute(async () => "recovered");
        console.log("✅ Request success in HALF_OPEN. Result: " + res);
        console.log("Status after success: " + CircuitState[cb.getState()]);

    } catch (e: any) {
        console.log("❌ Test failed: " + e.stack);
    }
}

test_cb().then(() => console.log("Circuit Breaker test complete."));
