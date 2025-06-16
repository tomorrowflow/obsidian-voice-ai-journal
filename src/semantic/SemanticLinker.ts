import type VoiceAIJournalPlugin from '../../main';
import { VectorCache } from './VectorCache';
import { 
    VectorEmbedding, 
    SemanticContext, 
    SimilarityResult, 
    VectorSearchOptions,
    SemanticConfig 
} from './types';

/**
 * Core semantic linking engine that connects journal entries with related notes
 */
export class SemanticLinker {
    private plugin: VoiceAIJournalPlugin;
    private vectorCache: VectorCache;
    private config: SemanticConfig;

    constructor(plugin: VoiceAIJournalPlugin, config?: Partial<SemanticConfig>) {
        this.plugin = plugin;
        this.vectorCache = new VectorCache(plugin);
        
        // Default configuration
        this.config = {
            enabled: true,
            similarityThreshold: 0.7,
            maxRelatedNotes: 5,
            maxSimilarEntries: 3,
            cacheExpiryDays: 30,
            excludePatterns: ['*.tmp', '*.cache'],
            ...config
        };
    }

    /**
     * Initialize the semantic linker
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            console.log('[SemanticLinker] Disabled by configuration');
            return;
        }

        await this.vectorCache.initialize();
        console.log('[SemanticLinker] Initialized successfully');
    }

    /**
     * Generate semantic context for a given text content
     */
    async generateSemanticContext(
        content: string, 
        currentFilePath?: string
    ): Promise<SemanticContext> {
        if (!this.config.enabled) {
            return this.getEmptyContext();
        }

        try {
            // Generate embedding for the content
            const embedding = await this.generateEmbedding(content);
            if (!embedding) {
                console.warn('[SemanticLinker] Failed to generate embedding');
                return this.getEmptyContext();
            }

            // Search for similar content
            const searchOptions: VectorSearchOptions = {
                limit: this.config.maxRelatedNotes + this.config.maxSimilarEntries,
                threshold: this.config.similarityThreshold,
                excludePaths: currentFilePath ? [currentFilePath] : []
            };

            const similarResults = await this.vectorCache.searchSimilar(embedding, searchOptions);

            // Process results into semantic context
            return this.processSearchResults(similarResults);

        } catch (error) {
            console.error('[SemanticLinker] Error generating semantic context:', error);
            return this.getEmptyContext();
        }
    }

    /**
     * Index a file's content for semantic search
     */
    async indexContent(
        filePath: string, 
        content: string, 
        title?: string, 
        excerpt?: string
    ): Promise<boolean> {
        if (!this.config.enabled) {
            return false;
        }

        try {
            // Check if file should be excluded
            if (this.shouldExcludeFile(filePath)) {
                return false;
            }

            // Generate embedding
            const embedding = await this.generateEmbedding(content);
            if (!embedding) {
                console.warn(`[SemanticLinker] Failed to generate embedding for ${filePath}`);
                return false;
            }

            // Store in cache
            await this.vectorCache.storeEmbedding(filePath, content, embedding, title, excerpt);
            console.log(`[SemanticLinker] Indexed ${filePath}`);
            return true;

        } catch (error) {
            console.error(`[SemanticLinker] Error indexing ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Remove a file from the semantic index
     */
    async removeFromIndex(filePath: string): Promise<void> {
        await this.vectorCache.removeEntry(filePath);
        console.log(`[SemanticLinker] Removed ${filePath} from index`);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SemanticConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('[SemanticLinker] Configuration updated');
    }

    /**
     * Get current configuration
     */
    getConfig(): SemanticConfig {
        return { ...this.config };
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { entryCount: number; lastUpdated: number; cacheSize: string } {
        return this.vectorCache.getStats();
    }

    /**
     * Clear the semantic cache
     */
    async clearCache(): Promise<void> {
        await this.vectorCache.clearCache();
        console.log('[SemanticLinker] Cache cleared');
    }

    /**
     * Clean up stale entries from the cache
     */
    async cleanupCache(): Promise<number> {
        const removedCount = await this.vectorCache.cleanupStaleEntries();
        console.log(`[SemanticLinker] Cleaned up ${removedCount} stale entries`);
        return removedCount;
    }

    /**
     * Find related notes for given content
     */
    async findRelatedNotes(content: string, maxResults: number = 5): Promise<SimilarityResult[]> {
        if (!this.config.enabled) {
            return [];
        }

        try {
            // Generate embedding for the content
            const embedding = await this.generateEmbedding(content);
            if (!embedding) {
                console.warn('[SemanticLinker] Failed to generate embedding for search');
                return [];
            }

            // Search for similar content
            const searchOptions: VectorSearchOptions = {
                limit: maxResults,
                threshold: this.config.similarityThreshold
            };

            const results = await this.vectorCache.searchSimilar(embedding, searchOptions);
            return results;

        } catch (error) {
            console.error('[SemanticLinker] Error finding related notes:', error);
            return [];
        }
    }

    /**
     * Generate embedding for text content using the AI manager
     */
    private async generateEmbedding(content: string): Promise<VectorEmbedding | null> {
        try {
            // Use the plugin's AI manager to generate embeddings
            if (!this.plugin.aiManager) {
                console.warn('[SemanticLinker] AI manager not available');
                return null;
            }

            // Clean and prepare content for embedding
            const cleanContent = this.preprocessContent(content);
            if (cleanContent.length === 0) {
                return null;
            }

            // Generate embedding using AI manager
            const embeddingVector = await this.plugin.aiManager.generateEmbedding(cleanContent);
            if (!embeddingVector || embeddingVector.length === 0) {
                return null;
            }

            return {
                vector: embeddingVector,
                dimensions: embeddingVector.length
            };

        } catch (error) {
            console.error('[SemanticLinker] Error generating embedding:', error);
            return null;
        }
    }

    /**
     * Preprocess content for embedding generation
     */
    private preprocessContent(content: string): string {
        // Remove markdown formatting
        let cleaned = content
            .replace(/#{1,6}\s+/g, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove inline code
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
            .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
            .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
            .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
            .trim();

        // Limit content length for embedding (most models have token limits)
        const maxLength = 8000; // Adjust based on your embedding model
        if (cleaned.length > maxLength) {
            cleaned = cleaned.substring(0, maxLength) + '...';
        }

        return cleaned;
    }

    /**
     * Process search results into semantic context
     */
    private processSearchResults(results: SimilarityResult[]): SemanticContext {
        const relatedNotes: string[] = [];
        const similarEntries: string[] = [];
        const suggestedTags: string[] = [];
        const thematicConnections: string[] = [];

        // Sort results by similarity
        const sortedResults = results.sort((a, b) => b.similarity - a.similarity);

        // Extract related notes and similar entries
        for (const result of sortedResults) {
            if (relatedNotes.length < this.config.maxRelatedNotes) {
                relatedNotes.push(this.formatNoteReference(result));
            }
            
            if (similarEntries.length < this.config.maxSimilarEntries) {
                similarEntries.push(this.formatSimilarEntry(result));
            }

            // Extract potential tags from file names and titles
            const tags = this.extractPotentialTags(result);
            suggestedTags.push(...tags);

            // Generate thematic connections
            const themes = this.extractThemes(result);
            thematicConnections.push(...themes);
        }

        // Remove duplicates and limit results
        return {
            relatedNotes: [...new Set(relatedNotes)].slice(0, this.config.maxRelatedNotes),
            similarEntries: [...new Set(similarEntries)].slice(0, this.config.maxSimilarEntries),
            suggestedTags: [...new Set(suggestedTags)].slice(0, 10),
            thematicConnections: [...new Set(thematicConnections)].slice(0, 5)
        };
    }

    /**
     * Format a note reference for display
     */
    private formatNoteReference(result: SimilarityResult): string {
        const fileName = result.filePath.split('/').pop()?.replace('.md', '') || 'Unknown';
        const similarity = Math.round(result.similarity * 100);
        
        if (result.title) {
            return `[[${fileName}|${result.title}]] (${similarity}% match)`;
        }
        
        return `[[${fileName}]] (${similarity}% match)`;
    }

    /**
     * Format a similar entry for display
     */
    private formatSimilarEntry(result: SimilarityResult): string {
        const fileName = result.filePath.split('/').pop()?.replace('.md', '') || 'Unknown';
        const similarity = Math.round(result.similarity * 100);
        
        if (result.excerpt) {
            const truncatedExcerpt = result.excerpt.length > 100 
                ? result.excerpt.substring(0, 100) + '...' 
                : result.excerpt;
            return `${fileName}: "${truncatedExcerpt}" (${similarity}% match)`;
        }
        
        return `${fileName} (${similarity}% match)`;
    }

    /**
     * Extract potential tags from a search result
     */
    private extractPotentialTags(result: SimilarityResult): string[] {
        const tags: string[] = [];
        
        // Extract from file path
        const pathParts = result.filePath.split('/');
        for (const part of pathParts) {
            if (part !== 'md' && part.length > 2 && part.length < 20) {
                tags.push(part.toLowerCase().replace(/[^a-z0-9]/g, ''));
            }
        }
        
        // Extract from title
        if (result.title) {
            const titleWords = result.title.toLowerCase().split(/\s+/);
            for (const word of titleWords) {
                if (word.length > 3 && word.length < 15) {
                    tags.push(word.replace(/[^a-z0-9]/g, ''));
                }
            }
        }
        
        return tags.filter(tag => tag.length > 0);
    }

    /**
     * Extract thematic connections from a search result
     */
    private extractThemes(result: SimilarityResult): string[] {
        const themes: string[] = [];
        
        // Simple theme extraction based on file structure and titles
        const pathParts = result.filePath.split('/');
        if (pathParts.length > 1) {
            const folder = pathParts[pathParts.length - 2];
            if (folder && folder !== '.' && folder.length > 2) {
                themes.push(`Related to ${folder}`);
            }
        }
        
        if (result.title) {
            themes.push(`Similar theme: ${result.title}`);
        }
        
        return themes;
    }

    /**
     * Check if a file should be excluded from indexing
     */
    private shouldExcludeFile(filePath: string): boolean {
        for (const pattern of this.config.excludePatterns) {
            // Simple pattern matching (could be enhanced with proper glob matching)
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(filePath)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get empty semantic context
     */
    private getEmptyContext(): SemanticContext {
        return {
            relatedNotes: [],
            similarEntries: [],
            suggestedTags: [],
            thematicConnections: []
        };
    }
}