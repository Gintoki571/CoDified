// src/config/env.ts

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root, not process.cwd()
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Environment Variable Schema
 * Enforces strict validation for critical configuration credentials.
 */
const envSchema = z.object({
    // Server & Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // LLM Configuration
    OPENAI_API_KEY: z.string().optional()
        .refine(val => {
            if (process.env.NODE_ENV === 'production') {
                return !!val && val.length > 20;
            }
            return true;
        }, { message: "OPENAI_API_KEY is required and must be a valid format in production" }),

    OPENAI_BASE_URL: z.string().url().optional(),

    LLM_MODEL: z.string().default('gpt-4o-mini'),

    // Provider Abstraction
    LLM_PROVIDER: z.enum(['openai', 'lmstudio', 'ollama']).default('openai'),
    VECTOR_STORE: z.enum(['lancedb', 'memory']).default('lancedb'),
    EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

    // Memory Strategy
    MEMORY_STRATEGY: z.enum(['smart', 'append', 'overwrite']).default('smart'),

    // Default user ID for multi-tenancy
    DEFAULT_USER_ID: z.string().default('default'),
});

// Process and validate
const _env = envSchema.parse(process.env);

// Custom validation logic for dependencies
if (!_env.OPENAI_BASE_URL && (!_env.OPENAI_API_KEY || _env.OPENAI_API_KEY === 'lm-studio')) {
    if (_env.NODE_ENV !== 'test') {
        process.stderr.write('⚠️  WARNING: No OPENAI_BASE_URL provided, defaulting to OpenAI API, but OPENAI_API_KEY is missing or invalid.\n');
    }
}

export const ENV = _env;
