// src/config/config.ts

import path from 'path';
import { ENV } from './env';

/**
 * Helper to get the project root directory. 
 * Derives the root from the file location to ensure consistency 
 * even if the process is started from a different working directory.
 */
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

interface ServerConfig {
    NAME: string;
    VERSION: string;
}

interface PathsConfig {
    PROJECT_ROOT: string;
    DATA_DIR: string;
}

interface SearchConfig {
    DEFAULT_LIMIT: number;
    DEFAULT_DEPTH: number;
}

interface ValidationConfig {
    MAX_NODE_NAME_LENGTH: number;
    MAX_TEXT_LENGTH: number;
}

interface RateLimitConfig {
    WINDOW_MS: number;
    MAX_REQUESTS: number;
}

interface Config {
    SERVER: ServerConfig;
    PATHS: PathsConfig;
    SEARCH: SearchConfig;
    VALIDATION: ValidationConfig;
    RATE_LIMIT: RateLimitConfig;
}

/**
 * Centralized configuration for CoDified.
 */
export const CONFIG: Config = {
    SERVER: {
        NAME: 'codified',
        VERSION: '1.0.0',
    },

    PATHS: {
        PROJECT_ROOT,
        DATA_DIR: path.join(PROJECT_ROOT, 'data'),
    },

    SEARCH: {
        DEFAULT_LIMIT: 5,
        DEFAULT_DEPTH: 1,
    },

    VALIDATION: {
        MAX_NODE_NAME_LENGTH: 200,
        MAX_TEXT_LENGTH: 10000,
    },

    RATE_LIMIT: {
        WINDOW_MS: 60 * 1000, // 1 minute
        MAX_REQUESTS: 100,    // 100 requests per minute
    },
};
