import { Module } from './types';
import { Logger } from '../logging/Logger';

/**
 * A reference implementation of a CoDified Module for Task Management.
 */
export class TaskModule implements Module {
    public readonly id = 'task-manager';
    public readonly name = 'Task Manager';
    public readonly description = 'Tracks and manages user tasks/todos within memories.';
    public readonly version = '1.0.0';

    private tasks: Map<string, { title: string; status: 'todo' | 'done' }> = new Map();

    async initialize(): Promise<void> {
        Logger.info('TaskModule', 'Task Manager module initialized.');
    }

    async shutdown(): Promise<void> {
        Logger.info('TaskModule', 'Task Manager module shutting down.');
    }

    /**
     * Add a task to the local module state.
     */
    public addTask(userId: string, taskId: string, title: string): void {
        const key = `${userId}:${taskId}`;
        this.tasks.set(key, { title, status: 'todo' });
        Logger.info('TaskModule', `Added task [${taskId}] for user [${userId}]`);
    }

    /**
     * Mark a task as completed.
     */
    public completeTask(userId: string, taskId: string): boolean {
        const key = `${userId}:${taskId}`;
        const task = this.tasks.get(key);
        if (task) {
            task.status = 'done';
            return true;
        }
        return false;
    }

    public getTasks(userId: string) {
        return Array.from(this.tasks.entries())
            .filter(([key]) => key.startsWith(`${userId}:`))
            .map(([key, task]) => ({ id: key.split(':')[1], ...task }));
    }
}
