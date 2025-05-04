/**
 * Timer utility for measuring and reporting processing times
 */

/**
 * Timer class to measure elapsed time for operations
 */
export class Timer {
    private startTime: number;
    private endTime: number | null = null;
    private name: string;

    /**
     * Create a new timer
     * @param name Name of the operation being timed
     */
    constructor(name: string) {
        this.name = name;
        this.startTime = performance.now();
    }

    /**
     * Stop the timer and return the elapsed time in milliseconds
     * @returns Elapsed time in milliseconds
     */
    stop(): number {
        this.endTime = performance.now();
        return this.getElapsedTime();
    }

    /**
     * Get the elapsed time in milliseconds
     * @returns Elapsed time in milliseconds
     */
    getElapsedTime(): number {
        const end = this.endTime || performance.now();
        return end - this.startTime;
    }

    /**
     * Format the elapsed time as a human-readable string
     * @returns Formatted time string
     */
    getFormattedTime(): string {
        const elapsed = this.getElapsedTime();
        
        if (elapsed < 1000) {
            return `${Math.round(elapsed)}ms`;
        } else if (elapsed < 60000) {
            return `${(elapsed / 1000).toFixed(2)}s`;
        } else {
            const minutes = Math.floor(elapsed / 60000);
            const seconds = ((elapsed % 60000) / 1000).toFixed(1);
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Get the name of this timer
     * @returns Timer name
     */
    getName(): string {
        return this.name;
    }
}

/**
 * Create and start a new timer
 * @param name Name of the operation being timed
 * @returns Timer instance
 */
export function startTimer(name: string): Timer {
    return new Timer(name);
}
