declare module '@obsidian-ai-providers/sdk' {
    /**
     * Initialize AI Providers integration
     */
    export function initAI(app: any, plugin: any, onLoad: () => void): void;
    
    /**
     * Wait for AI Providers to be loaded
     */
    export function waitForAI(): Promise<{ promise: any }>;
}
