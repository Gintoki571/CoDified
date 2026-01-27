// tests/unit/validation.test.ts

import { validateNodeName, escapeSqlString, ValidationError } from '../../src/core/validation';

describe('Security Validation', () => {
    describe('validateNodeName', () => {
        it('should allow valid node names', () => {
            expect(() => validateNodeName('valid_node-123')).not.toThrow();
            expect(() => validateNodeName('ConceptA')).not.toThrow();
        });

        it('should block empty/null names', () => {
            expect(() => validateNodeName('')).toThrow(ValidationError);
            expect(() => (validateNodeName as any)(null)).toThrow(ValidationError);
        });

        it('should block names with SQL/HTML special characters', () => {
            const badNames = ["node' OR 1=1--", "node<script>", "node; DROP TABLE", "node\""];
            badNames.forEach(name => {
                expect(() => validateNodeName(name)).toThrow(/Forbidden characters/i);
            });
        });

        it('should block Unicode attacks', () => {
            const toxicNames = [
                "node\x00", // Null byte
                "node\u202e", // RLO
                "node\u200b", // zero-width space
                "node\uffff" // invalid
            ];
            toxicNames.forEach(name => {
                expect(() => validateNodeName(name)).toThrow(/Security violation/i);
            });
        });

        it('should block names exceeding max length', () => {
            const longName = 'a'.repeat(201);
            expect(() => validateNodeName(longName)).toThrow(/exceeds maximum length/i);
        });
    });

    describe('escapeSqlString', () => {
        it('should escape single quotes', () => {
            expect(escapeSqlString("it's a node")).toBe("it''s a node");
        });

        it('should handle strings without quotes', () => {
            expect(escapeSqlString("clean string")).toBe("clean string");
        });
    });
});
