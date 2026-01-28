import { Mutex } from 'async-mutex';
import { Module } from './types';
import { Logger } from '../logging/Logger';

/**
 * Singleton Manager for CoDified Modules.
 * Handles safe registration, initialization, and disposal of modules.
 */
export class ModuleManager {
    private static instance: ModuleManager;
    private modules: Map<string, Module> = new Map();
    private registrationMutex: Mutex = new Mutex();

    private constructor() { }

    public static getInstance(): ModuleManager {
        if (!ModuleManager.instance) {
            ModuleManager.instance = new ModuleManager();
        }
        return ModuleManager.instance;
    }

    /**
     * Safely registers and initializes a new module.
     * Uses a Mutex to prevent race conditions during dynamic loading.
     */
    public async registerModule(module: Module): Promise<void> {
        return await this.registrationMutex.runExclusive(async () => {
            if (this.modules.has(module.id)) {
                Logger.info('ModuleManager', `Module ${module.id} is already registered. Skipping.`);
                return;
            }

            try {
                Logger.info('ModuleManager', `Initializing module: ${module.name} (v${module.version})...`);
                await module.initialize();
                this.modules.set(module.id, module);
                Logger.info('ModuleManager', `Module ${module.id} registered successfully.`);
            } catch (error) {
                Logger.error('ModuleManager', `Failed to initialize module ${module.id}:`, error);
                throw error;
            }
        });
    }

    /**
     * Unregisters a module and calls its shutdown logic.
     */
    public async unregisterModule(moduleId: string): Promise<void> {
        return await this.registrationMutex.runExclusive(async () => {
            const module = this.modules.get(moduleId);
            if (!module) return;

            try {
                if (module.shutdown) {
                    await module.shutdown();
                }
                this.modules.delete(moduleId);
                Logger.info('ModuleManager', `Module ${moduleId} unregistered.`);
            } catch (error) {
                Logger.error('ModuleManager', `Error during module ${moduleId} shutdown:`, error);
            }
        });
    }

    /**
     * Gets a registered module by its ID.
     */
    public getModule<T extends Module>(moduleId: string): T | undefined {
        return this.modules.get(moduleId) as T | undefined;
    }

    /**
     * Lists all currently registered modules.
     */
    public listModules(): Module[] {
        return Array.from(this.modules.values());
    }
}
