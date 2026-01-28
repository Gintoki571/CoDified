/**
 * Interface for CoDified Modules.
 * A module is a self-contained piece of logic that extends the system's capabilities.
 */
export interface Module {
    /** Unique identifier for the module (e.g., 'task-manager') */
    id: string;

    /** Human-readable name */
    name: string;

    /** Description of what the module does */
    description: string;

    /** Version of the module */
    version: string;

    /**
     * Initialization logic for the module.
     * Called when the module is registered.
     */
    initialize(): Promise<void>;

    /**
     * Optional: Logic to execute before shutdown.
     */
    shutdown?(): Promise<void>;
}

/**
 * Interface for Module Metadata in the knowledge graph.
 */
export interface ModuleMetadata {
    moduleId: string;
    isActive: boolean;
    config?: Record<string, any>;
}
