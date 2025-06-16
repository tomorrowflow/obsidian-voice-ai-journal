/**
 * Type definitions for semantic linking system
 */

/**
 * Vector embedding representation
 */
export interface VectorEmbedding {
    vector: number[];
    dimensions: number;
}

/**
 * Cached vector entry with metadata
 */
export interface VectorCacheEntry {
    filePath: string;
    contentHash: string;
    embedding: VectorEmbedding;
    lastModified: number;
    title?: string;
    excerpt?: string;
}

/**
 * Vector cache storage format
 */
export interface VectorCacheData {
    version: string;
    entries: Record<string, VectorCacheEntry>;
    lastUpdated: number;
}

/**
 * Semantic similarity result
 */
export interface SimilarityResult {
    filePath: string;
    similarity: number;
    title?: string;
    excerpt?: string;
}

/**
 * Semantic context for template processing
 */
export interface SemanticContext {
    relatedNotes: string[];
    similarEntries: string[];
    suggestedTags: string[];
    thematicConnections: string[];
}

/**
 * Enhanced template variables with semantic data
 */
export interface EnhancedTemplateVariables extends Record<string, string> {
    transcription: string;
    summary: string;
    related_notes: string;
    similar_entries: string;
    suggested_tags: string;
    thematic_connections: string;
}

/**
 * Configuration for semantic linking
 */
export interface SemanticConfig {
    enabled: boolean;
    similarityThreshold: number;
    maxRelatedNotes: number;
    maxSimilarEntries: number;
    cacheExpiryDays: number;
    excludePatterns: string[];
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
    limit?: number;
    threshold?: number;
    excludePaths?: string[];
    includePatterns?: string[];
}