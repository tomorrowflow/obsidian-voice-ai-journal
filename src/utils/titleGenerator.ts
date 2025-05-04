import type VoiceAIJournalPlugin from '../../main';

/**
 * Generate a concise title for a journal entry
 * 
 * @param plugin The VoiceAIJournalPlugin instance
 * @param transcription The transcription text
 * @param detectedLanguage Optional detected language name
 * @param languageCode Optional detected language code
 * @returns A concise title (max 4 words)
 */
export async function generateNoteTitle(
    plugin: VoiceAIJournalPlugin,
    transcription: string,
    detectedLanguage?: string,
    languageCode?: string
): Promise<string> {
    try {
        // Get the AI provider for analysis
        const analysisProviderId = plugin.settings.aiProviders.analysis;
        
        if (!analysisProviderId) {
            console.warn('No analysis provider configured for title generation');
            return '';
        }
        
        // Create a prompt for generating a concise title
        const titlePrompt = 'Generate a concise, descriptive title (maximum 4 words) that captures the essence of this note. The title should be specific and meaningful. ONLY return the title text itself, with no quotes, prefixes, or additional commentary. Avoid special characters like \\, / and :';
        
        // Get the LLM response for title generation
        const response = await plugin.aiManager.analyzeText(
            transcription,
            titlePrompt,
            analysisProviderId,
            detectedLanguage,  // Pass the detected language
            languageCode      // Pass the language code
        );
        
        if (!response) {
            console.warn('Title generation returned empty response');
            return '';
        }
        
        // Clean up the response (remove quotes, newlines, etc.)
        let title = response.trim();
        title = title.replace(/^["']|["']$/g, ''); // Remove surrounding quotes if present
        title = title.replace(/\n/g, ' ').trim(); // Replace newlines with spaces
        
        // Ensure the title is not too long (max 4 words)
        const words = title.split(/\s+/);
        if (words.length > 4) {
            title = words.slice(0, 4).join(' ');
        }
        
        console.log(`Generated title: "${title}"`);
        return title;
    } catch (error) {
        console.error('Error generating note title:', error);
        return ''; // Return empty string on error
    }
}
