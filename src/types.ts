/**
 * Type definitions for Voice AI Journal plugin
 */

/**
 * Interface for journal templates
 */
export interface TemplateSection {
	title: string;
	content: string;
	prompt: string;
}

export interface JournalTemplate {
	id: string;
	name: string;
	description: string;
	sections: TemplateSection[];
}

/**
 * Interface for AI Providers plugin integration
 * This defines the structure of the API we receive from the AI Providers plugin
 */
export interface AIProviders {
    providers: AIProvider[];
    execute: (options: AIExecuteOptions) => Promise<AIStreamHandler>;
    embed: (options: AIEmbedOptions) => Promise<number[]>;
    fetchModels: (provider: AIProvider) => Promise<string[]>;
    migrateProvider: (provider: AIProvider) => Promise<AIProvider | false>;
}

/**
 * Interface for a provider from the AI Providers plugin
 */
export interface AIProvider {
    id: string;
    type: string;
    name: string;
    url?: string;
    apiKey?: string;
    model: string;
    availableModels?: string[];
}

/**
 * Options for executing AI requests
 */
export interface AIExecuteOptions {
    provider: AIProvider;
    prompt?: string;
    messages?: AIMessage[];
    images?: string[];
}

/**
 * Options for embedding text
 */
export interface AIEmbedOptions {
    provider: AIProvider;
    input: string;
}

/**
 * Message format for chat-based AI requests
 */
export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | AIContentBlock[];
}

/**
 * Content block for multimodal messages
 */
export interface AIContentBlock {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
    };
}

/**
 * Handler for streaming AI responses
 */
export interface AIStreamHandler {
    onData: (callback: (chunk: string, accumulatedText: string) => void) => void;
    onEnd: (callback: (fullText: string) => void) => void;
    onError: (callback: (error: Error) => void) => void;
    abort: () => void;
}
