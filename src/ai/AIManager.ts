import type { AIProvider, AIProviders } from '../types';
import type VoiceAIJournalPlugin from '../../main';

/**
 * Class responsible for managing AI interactions via the AI Providers plugin
 * and local transcription providers
 */
export class AIManager {
    private aiProviders: AIProviders | null;
    private plugin?: VoiceAIJournalPlugin;

    constructor(aiProviders: AIProviders | null, plugin?: VoiceAIJournalPlugin) {
        this.aiProviders = aiProviders;
        this.plugin = plugin;
    }

    /**
     * Check if AI Providers is properly initialized
     */
    isInitialized(): boolean {
        return !!this.aiProviders && !!this.aiProviders.providers;
    }

    /**
     * Get all available AI providers
     */
    getProviders(): AIProvider[] | null {
        if (!this.isInitialized()) {
            return null;
        }
        return this.aiProviders?.providers || null;
    }

    /**
     * Get provider by ID
     */
    getProviderById(id: string): AIProvider | null {
        if (!this.isInitialized()) {
            return null;
        }
        return this.aiProviders?.providers?.find((p: AIProvider) => p.id === id) || null;
    }

    /**
     * Transcribe audio data to text
     * @param audioBlob Audio data as a blob
     * @param providerId Optional AI provider ID to use for transcription
     * @param language Optional language code for transcription
     * @returns The transcription text
     */
    async transcribeAudio(audioBlob: Blob, providerId: string | null, language?: string): Promise<string> {
        // Check settings for transcription provider
        const transcriptionProvider = this.plugin?.settings?.transcriptionProvider || 'aiProviders';
        
        // Get language setting from plugin settings or use provided language
        const transcriptionLanguage = language || (this.plugin?.settings?.transcriptionLanguage || 'auto');
        
        // Use local Whisper ASR if configured
        if (transcriptionProvider === 'localWhisper') {
            return this.transcribeWithLocalWhisper(audioBlob, transcriptionLanguage);
        } 
        
        // Otherwise use AI Providers for transcription
        if (!this.isInitialized()) {
            throw new Error('AI Providers not initialized');
        }

        // Find the provider
        const provider = providerId ? this.getProviderById(providerId) : (this.aiProviders?.providers?.[0] || null);
        if (!provider) {
            throw new Error('No AI provider available for transcription');
        }
        
        // Convert audio to base64
        const base64Audio = await this.blobToBase64(audioBlob);

        try {
            // Execute transcription
            if (!this.aiProviders) throw new Error('AI Providers not available');
            
            // Build prompt with language instructions if needed
            let prompt = `Transcribe the following audio`;
            if (transcriptionLanguage && transcriptionLanguage !== 'auto') {
                prompt += ` in ${transcriptionLanguage} language`;
            }
            prompt += `: ${base64Audio}`;
            
            const response = await this.aiProviders.execute({
                provider: provider,
                prompt: prompt,
            });

            if (!response) {
                throw new Error('Failed to get transcription response');
            }

            // Handle the response
            return new Promise((resolve, reject) => {
                response.onData(() => {
                    // Simply listen for data events
                });
                
                response.onEnd((text: string) => {
                    resolve(text);
                });
                
                response.onError((error: Error) => {
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Transcription error:', error);
            throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Transcribe audio using local Whisper ASR server
     * 
     * @param audioBlob The audio blob to transcribe
     * @param language Language code for transcription
     * @returns Transcription text
     */
    private async transcribeWithLocalWhisper(audioBlob: Blob, language: string): Promise<string> {
        // Get the endpoint from settings
        const endpoint = this.plugin?.settings?.localWhisperEndpoint;
        if (!endpoint) {
            throw new Error('Local Whisper endpoint not configured');
        }
        
        // Prepare the form data
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'recording.wav');
        
        // Add language if it's not auto
        if (language && language !== 'auto') {
            formData.append('language', language);
        }
        
        try {
            // Make the API request
            const response = await fetch(`${endpoint}/asr`, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.text || '';
        } catch (error) {
            console.error('Local Whisper transcription error:', error);
            throw new Error(`Failed to transcribe with Local Whisper: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Transcribe an audio file
     * 
     * @param file The file to be transcribed
     * @returns The transcription text
     */
    async transcribeAudioFile(file: File): Promise<string> {
        // Convert the file to a blob
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        
        // The transcribeAudio method will check the transcription provider setting
        // and use the appropriate method (local Whisper or AI Providers)
        const providerId = this.plugin?.settings?.aiProviders?.transcription || null;

        // Transcribe the audio using the existing method
        return this.transcribeAudio(blob, providerId);
    }

    /**
     * Convert a Blob to a base64 string
     * @param blob The blob to convert
     * @returns A Promise that resolves to the base64 string
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Analyze text using the selected AI provider
     * 
     * @param text The text to analyze
     * @param prompt The prompt to guide the analysis
     * @param providerId The ID of the AI provider to use
     * @returns The analysis result
     */
    /**
     * Get enhanced system prompt with language instructions
     * @param detectedLanguage Optional language detected from transcription
     * @returns Enhanced system prompt with language instructions
     */
    private getEnhancedSystemPrompt(detectedLanguage?: string): string {
        if (!this.plugin?.settings) {
            return '';
        }

        // Get the base system prompt from settings
        let systemPrompt = this.plugin.settings.globalSystemPrompt || '';
        
        // Determine which language to use for the response
        const outputLanguage = this.plugin.settings.outputLanguage || 'auto';
        
        // If output language is explicitly set (not auto), add language instruction
        if (outputLanguage !== 'auto') {
            // Map language codes to full language names for clarity
            const languageNames: Record<string, string> = {
                'en': 'English',
                'fr': 'French',
                'de': 'German',
                'es': 'Spanish',
                'it': 'Italian',
                'pt': 'Portuguese',
                'nl': 'Dutch',
                'ja': 'Japanese',
                'zh': 'Chinese',
                'ko': 'Korean',
                'ru': 'Russian'
            };
            
            const languageName = languageNames[outputLanguage] || outputLanguage;
            systemPrompt += `\n\nPlease respond in ${languageName} language.`;
        } 
        // If set to auto and we have a detected language, use that
        else if (detectedLanguage && detectedLanguage !== 'auto') {
            // Map language codes to full language names for clarity
            const languageNames: Record<string, string> = {
                'en': 'English',
                'fr': 'French',
                'de': 'German',
                'es': 'Spanish',
                'it': 'Italian',
                'pt': 'Portuguese',
                'nl': 'Dutch',
                'ja': 'Japanese',
                'zh': 'Chinese',
                'ko': 'Korean',
                'ru': 'Russian'
            };
            
            // Check if it's a language code or already a full language name
            let languageName: string;
            
            if (detectedLanguage.length <= 3 && languageNames[detectedLanguage]) {
                // It's a language code, convert to full name
                languageName = languageNames[detectedLanguage];
                console.log(`Converted language code ${detectedLanguage} to ${languageName}`);
            } else {
                // It's already a full language name or unknown format, use as-is
                languageName = detectedLanguage;
                console.log(`Using provided language name directly: ${languageName}`);
            }
            
            systemPrompt += `\n\nPlease respond in ${languageName} language.`;
        }
        
        return systemPrompt;
    }

    async analyzeText(text: string, prompt: string, providerId: string | null, detectedLanguage?: string): Promise<string> {
        if (!this.isInitialized()) {
            throw new Error('AI Providers not initialized');
        }

        // Find the provider
        const provider = providerId ? this.getProviderById(providerId) : (this.aiProviders?.providers?.[0] || null);
        if (!provider) {
            throw new Error('No AI provider available for analysis');
        }

        try {
            // If no detected language parameter was provided, fall back to settings
            const languageToUse = detectedLanguage || this.plugin?.settings?.transcriptionLanguage;
            
            // Get enhanced system prompt with language instructions
            const systemPrompt = this.getEnhancedSystemPrompt(languageToUse);
            
            // Combine the prompt and text
            const combinedPrompt = `${prompt}\n\nContent to analyze:\n${text}`;
            
            // Execute the analysis using AI Providers
            if (!this.aiProviders) throw new Error('AI Providers not available');
            const response = await this.aiProviders.execute({
                provider: provider,
                prompt: combinedPrompt,
                systemPrompt: systemPrompt, // Include the enhanced system prompt
            });

            // Handle the response
            return new Promise((resolve, reject) => {
                response.onData(() => {
                    // Simply listen for data events
                });
                
                response.onEnd((responseText: string) => {
                    // Remove any <think>...</think> sections from the LLM response
                    const cleanedText = this.removeThinkingSections(responseText);
                    resolve(cleanedText);
                    console.log('LLM Analysis complete:', cleanedText);
                });
                
                response.onError((error: Error) => {
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Analysis error:', error);
            throw new Error(`Failed to analyze text: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Analyze a journal entry and generate a visualization (like a Mermaid chart)
     * 
     * @param text The journal entry text
     * @param providerId The ID of the AI provider to use
     * @returns A Mermaid chart definition
     */
    async generateMermaidChart(text: string, providerId: string | null): Promise<string> {
        if (!this.isInitialized()) {
            throw new Error('AI Providers not initialized');
        }

        // Find the provider
        const provider = providerId ? this.getProviderById(providerId) : (this.aiProviders?.providers?.[0] || null);
        if (!provider) {
            throw new Error('No AI provider available for visualization');
        }

        try {
            // Get detected language from settings, if any
            const detectedLanguage = this.plugin?.settings?.transcriptionLanguage;
            
            // Get enhanced system prompt with language instructions
            const systemPrompt = this.getEnhancedSystemPrompt(detectedLanguage);
            
            const prompt = `
Create a simple Mermaid chart that visualizes the key concepts, relationships, or themes in the following journal entry.
Use either a flowchart, mindmap, or another appropriate Mermaid diagram type.
Keep the chart relatively simple with no more than 8-10 nodes.
Your response should ONLY contain a valid mermaid code block that starts with \`\`\`mermaid and ends with \`\`\` and nothing else.

Journal entry:
${text}
`;

            // Execute the request using AI Providers
            if (!this.aiProviders) throw new Error('AI Providers not available');
            const response = await this.aiProviders.execute({
                provider: provider,
                prompt,
                systemPrompt: systemPrompt, // Include the global system prompt
            });

            // Handle the response
            return new Promise((resolve, reject) => {
                // No need to track fullText as we use onEnd callback
                
                // Just listen for data events
                response.onData(() => {});

                response.onEnd((finalText: string) => {
                    // Extract just the mermaid code from the response
                    const mermaidMatch = finalText.match(/```mermaid\s*([\s\S]*?)\s*```/);
                    if (mermaidMatch && mermaidMatch[1]) {
                        resolve(mermaidMatch[1].trim());
                    } else {
                        resolve(finalText); // Return the full text if we can't extract the mermaid part
                    }
                });
                
                response.onError((error: Error) => {
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Mermaid generation error:', error);
            throw new Error(`Failed to generate mermaid chart: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Fix a potentially broken Mermaid chart
     * 
     * @param mermaidCode The Mermaid chart code to fix
     * @returns The fixed Mermaid chart code
     */
    async fixMermaidChart(mermaidCode: string): Promise<string> {
        if (!this.isInitialized()) {
            throw new Error('AI Providers not initialized');
        }

        // Use the first available provider
        const provider = this.aiProviders?.providers?.[0];
        if (!provider) {
            throw new Error('No AI provider available');
        }

        try {
            // Get detected language from settings, if any
            const detectedLanguage = this.plugin?.settings?.transcriptionLanguage;
            
            // Get enhanced system prompt with language instructions
            const systemPrompt = this.getEnhancedSystemPrompt(detectedLanguage);
            
            const prompt = `
Fix this Mermaid chart code to make it valid. 
Only respond with the fixed Mermaid code, with no additional explanation.
Do not include the \`\`\`mermaid and \`\`\` markers in your response.

${mermaidCode}
`;

            // Execute the request using AI Providers
            if (!this.aiProviders) throw new Error('AI Providers not available');
            const response = await this.aiProviders.execute({
                provider: provider,
                prompt,
                systemPrompt: systemPrompt, // Include the global system prompt
            });

            // Handle the response
            return new Promise((resolve, reject) => {
                // No need to track fullText as we use onEnd callback
                
                // Just listen for data events
                response.onData(() => {});

                response.onEnd((finalText: string) => {
                    // Remove any markdown code markers that might be in the response
                    const cleanedText = finalText.replace(/```mermaid\s*|\s*```/g, '').trim();
                    resolve(cleanedText);
                });
                
                response.onError((error: Error) => {
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Mermaid fix error:', error);
            throw new Error(`Failed to fix mermaid chart: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Removes <think>...</think> sections from the LLM response
     * 
     * @param text The original LLM response text
     * @returns The cleaned text without thinking sections
     */
    private removeThinkingSections(text: string): string {
        // Use regex to remove any content between <think> and </think> tags, including the tags
        return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }
}
