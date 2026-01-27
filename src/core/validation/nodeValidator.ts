// src/core/validation/nodeValidator.ts

import { CONFIG } from '../../config/config';

/**
 * Whitelist pattern for node names.
 * Prevents SQL injection, control characters, and allows only safe identifiers.
 */
const NODE_NAME_REGEX = /^[a-zA-Z0-9_-]{1,200}$/;

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Validate node name against whitelist to prevent injection attacks.
 * 
 * Includes defense-in-depth against:
 * 1. Null byte injection
 * 2. Right-to-left override attacks
 * 3. Zero-width space confusion
 * 4. HTML/SQL special characters
 */
export function validateNodeName(nodeName: string): void {
    if (!nodeName) {
        throw new ValidationError('Node name cannot be empty');
    }

    // Additional security checks for control characters and Unicode attacks
    if (nodeName.includes('\x00') || // Null byte injection
        nodeName.includes('\u202e') || // Right-to-left override
        nodeName.includes('\u200f') || // Right-to-left mark
        nodeName.includes('\u200b') || // Zero-width space
        nodeName.includes('\uffff')) { // Invalid Unicode
        throw new ValidationError(
            `Security violation: Invalid Unicode characters detected in node name.`
        );
    }

    // Block HTML/SQL special chars specifically if they bypass regex (defense in depth)
    if (/[<>\"'\\]/.test(nodeName)) {
        throw new ValidationError(
            `Security violation: Forbidden characters detected in node name.`
        );
    }

    if (!NODE_NAME_REGEX.test(nodeName)) {
        throw new ValidationError(
            `Invalid node name: '${nodeName.substring(0, 50)}'. ` +
            `Must match pattern: ${NODE_NAME_REGEX.source}`
        );
    }

    if (nodeName.length > CONFIG.VALIDATION.MAX_NODE_NAME_LENGTH) {
        throw new ValidationError(
            `Node name exceeds maximum length of ${CONFIG.VALIDATION.MAX_NODE_NAME_LENGTH}`
        );
    }
}

/**
 * Escapes characters that could be used for SQL-like injection.
 * Defense in depth for places where raw filters are constructed.
 */
export function escapeSqlString(str: string): string {
    return str.replace(/'/g, "''");
}

/**
 * Creates a safe filter string for node name lookups.
 * Combines validation and escaping.
 */
export function createNodeNameFilter(nodeName: string): string {
    validateNodeName(nodeName);
    const safeName = escapeSqlString(nodeName);
    return `nodeName = '${safeName}'`;
}
