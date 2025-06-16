import type VoiceAIJournalPlugin from '../../main';
import {
    VectorCacheData,
    VectorCacheEntry,
    VectorEmbedding,
    SimilarityResult,
    VectorSearchOptions
} from './types';

/**
 * Lightweight file-based vector cache for semantic search
 */
export class VectorCache {
    private plugin: VoiceAIJournalPlugin;
    private cache: VectorCacheData;
    private cacheFilePath: string;
    private isLoaded: boolean = false;

    constructor(plugin: VoiceAIJournalPlugin) {
        this.plugin = plugin;
        // Store cache in plugin data directory - use a simple path for now
        this.cacheFilePath = `.obsidian/plugins/voice-ai-journal/vector-cache.json`;
        this.cache = {
            version: '1.0.0',
            entries: {},
            lastUpdated: Date.now()
        };
    }

    /**
     * Initialize the cache by loading from file
     */
    async initialize(): Promise<void> {
        if (this.isLoaded) return;
        
        await this.loadCache();
        this.isLoaded = true;
        console.log('[VectorCache] Initialized successfully');
    }

    /**
     * Load cache from file
     */
    private async loadCache(): Promise<void> {
        try {
            const cacheExists = await (this.plugin as any).app.vault.adapter.exists(this.cacheFilePath);
            if (!cacheExists) {
                console.log('[VectorCache] No existing cache found, starting fresh');
                return;
            }

            const cacheFile = await (this.plugin as any).app.vault.adapter.read(this.cacheFilePath);
            const data = JSON.parse(cacheFile);
            
            // Validate cache structure
            if (data.version && data.entries && typeof data.lastUpdated === 'number') {
                this.cache = data;
                console.log(`[VectorCache] Loaded ${Object.keys(this.cache.entries).length} cached embeddings`);
            } else {
                console.warn('[VectorCache] Invalid cache format, starting fresh');
            }
        } catch (error) {
            console.warn('[VectorCache] Error loading cache:', error);
            // File doesn't exist or is corrupted, start with empty cache
        }
    }

    /**
     * Save cache to file
     */
    private async saveCache(): Promise<void> {
        try {
            this.cache.lastUpdated = Date.now();
            const cacheData = JSON.stringify(this.cache, null, 2);
            await (this.plugin as any).app.vault.adapter.write(this.cacheFilePath, cacheData);
        } catch (error) {
            console.error('[VectorCache] Failed to save cache:', error);
        }
    }

    /**
     * Store an embedding in the cache
     */
    async storeEmbedding(filePath: string, content: string, embedding: VectorEmbedding, title?: string, excerpt?: string): Promise<void> {
        if (!this.isLoaded) {
            await this.initialize();
        }

        const contentHash = this.hashContent(content);
        
        this.cache.entries[filePath] = {
            filePath,
            contentHash,
            embedding,
            lastModified: Date.now(),
            title,
            excerpt
        };

        await this.saveCache();
    }

    /**
     * Get an embedding from the cache if it exists and is valid
     */
    async getEmbedding(filePath: string, content: string): Promise<VectorEmbedding | null> {
        if (!this.isLoaded) {
            await this.initialize();
        }

        const entry = this.cache.entries[filePath];
        if (!entry) {
            return null;
        }

        // Check if content has changed
        const currentHash = this.hashContent(content);
        if (entry.contentHash !== currentHash) {
            // Content has changed, remove stale entry
            delete this.cache.entries[filePath];
            await this.saveCache();
            return null;
        }

        return entry.embedding;
    }

    /**
     * Remove an entry from the cache
     */
    async removeEntry(filePath: string): Promise<void> {
        if (!this.isLoaded) {
            await this.initialize();
        }

        if (this.cache.entries[filePath]) {
            delete this.cache.entries[filePath];
            await this.saveCache();
        }
    }

    /**
     * Search for similar embeddings using cosine similarity
     */
    async searchSimilar(
        queryEmbedding: VectorEmbedding, 
        options: VectorSearchOptions = {}
    ): Promise<SimilarityResult[]> {
        if (!this.isLoaded) {
            await this.initialize();
        }

        const {
            limit = 10,
            threshold = 0.7,
            excludePaths = []
        } = options;

        const results: SimilarityResult[] = [];

        for (const filePath in this.cache.entries) {
            const entry = this.cache.entries[filePath];
            
            // Skip excluded paths
            if (excludePaths.includes(filePath)) {
                continue;
            }

            const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
            
            if (similarity >= threshold) {
                results.push({
                    filePath,
                    similarity,
                    title: entry.title,
                    excerpt: entry.excerpt
                });
            }
        }

        // Sort by similarity (highest first) and limit results
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Get cache statistics
     */
    getStats(): { entryCount: number; lastUpdated: number; cacheSize: string } {
        const entryCount = Object.keys(this.cache.entries).length;
        const cacheSize = this.formatBytes(JSON.stringify(this.cache).length);
        
        return {
            entryCount,
            lastUpdated: this.cache.lastUpdated,
            cacheSize
        };
    }

    /**
     * Clear all cache entries
     */
    async clearCache(): Promise<void> {
        this.cache.entries = {};
        this.cache.lastUpdated = Date.now();
        await this.saveCache();
        console.log('[VectorCache] Cache cleared');
    }

    /**
     * Remove stale entries (files that no longer exist)
     */
    async cleanupStaleEntries(): Promise<number> {
        if (!this.isLoaded) {
            await this.initialize();
        }

        let removedCount = 0;
        const filePaths = Object.keys(this.cache.entries);

        for (const filePath of filePaths) {
            try {
                const fileExists = await (this.plugin as any).app.vault.adapter.exists(filePath);
                if (!fileExists) {
                    delete this.cache.entries[filePath];
                    removedCount++;
                }
            } catch (error) {
                // If we can't check the file, assume it doesn't exist
                delete this.cache.entries[filePath];
                removedCount++;
            }
        }

        if (removedCount > 0) {
            await this.saveCache();
            console.log(`[VectorCache] Removed ${removedCount} stale entries`);
        }

        return removedCount;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: VectorEmbedding, b: VectorEmbedding): number {
        const vectorA = a.vector;
        const vectorB = b.vector;
        
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vector dimensions must match for similarity calculation');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    /**
     * Create a simple hash of content for change detection
     */
    private hashContent(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Format bytes to human readable string
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}