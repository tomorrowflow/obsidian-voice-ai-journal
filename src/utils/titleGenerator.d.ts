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
export function generateNoteTitle(
    plugin: VoiceAIJournalPlugin,
    transcription: string,
    detectedLanguage?: string,
    languageCode?: string
): Promise<string>;
