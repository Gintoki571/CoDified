import { getDatabase } from '../../infrastructure/database';
import { nodes } from '../../infrastructure/database/schema';
import { eq, and, lt } from 'drizzle-orm';
import { Logger } from '../logging/Logger';

/**
 * RecoveryWorker
 * 
 * Periodically checks for memories stuck in 'PENDING' status (e.g., due to crash)
 * and re-triggers processing or marks them for manual review.
 */
export class RecoveryWorker {
    private static instance: RecoveryWorker;
    private interval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    private constructor() { }

    public static getInstance(): RecoveryWorker {
        if (!RecoveryWorker.instance) {
            RecoveryWorker.instance = new RecoveryWorker();
        }
        return RecoveryWorker.instance;
    }

    /**
     * Start the recovery polling loop
     */
    public start(intervalMs: number = 300000): void { // Default 5 mins
        if (this.interval) return;

        Logger.info('RecoveryWorker', `Starting recovery loop every ${intervalMs}ms`);
        this.interval = setInterval(() => this.runRecovery(), intervalMs);

        // Run immediately on start
        this.runRecovery();
    }

    /**
     * Stop the recovery loop
     */
    public stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private async runRecovery(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            const timeoutThreshold = new Date(Date.now() - 600000); // 10 mins ago

            Logger.debug('RecoveryWorker', `Checking for PENDING memories older than ${timeoutThreshold.toISOString()}`);

            const stuckNodes = await getDatabase().select().from(nodes).where(
                and(
                    eq(nodes.status, 'PENDING'),
                    lt(nodes.updatedAt, timeoutThreshold)
                )
            );

            if (stuckNodes.length === 0) {
                this.isRunning = false;
                return;
            }

            Logger.warn('RecoveryWorker', `Found ${stuckNodes.length} stuck PENDING nodes. Marking as FAILED for manual review/retry.`);

            for (const node of stuckNodes) {
                await getDatabase().update(nodes)
                    .set({
                        status: 'FAILED',
                        updatedAt: new Date(),
                        metadata: { ... (node.metadata as any || {}), recovery_note: 'Marked as FAILED by RecoveryWorker due to timeout' }
                    })
                    .where(eq(nodes.id, node.id));
            }

        } catch (error) {
            Logger.error('RecoveryWorker', 'Recovery loop failed', error);
        } finally {
            this.isRunning = false;
        }
    }
}
