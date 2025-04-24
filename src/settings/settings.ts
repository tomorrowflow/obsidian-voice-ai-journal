import { JournalTemplate } from '../types';

/**
 * Interface for plugin settings
 */
export interface VoiceAIJournalSettings {
	// Template settings
	templates: JournalTemplate[];
	defaultTemplate: string;

	// AI provider settings
	transcriptionProvider: 'aiProviders' | 'localWhisper'; // Which transcription provider to use
	localWhisperEndpoint: string; // URL for local whisper API endpoint
	aiProviders: {
		transcription: string | null;
		analysis: string | null;
		mermaidFixer: string | null;
	};

	// Audio settings
	audioQuality: 'low' | 'medium' | 'high';
	automaticSpeechDetection: boolean;
	transcriptionLanguage: string; // Language for speech recognition

	// Journal settings
	noteLocation: string;
	noteNamingFormat: string;
	recordingsLocation: string;
	appendToExistingNote: boolean;

	// UI settings
	
	// Version tracking
	_version: number;
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: VoiceAIJournalSettings = {
	templates: [
		{
			id: 'default',
			name: 'Default Journal Entry',
			description: 'Standard journal entry with transcription and summary',
			template: '# {{date:YYYY-MM-DD}} Journal Entry\n\n## Voice Note\n{{transcription}}\n\n## Summary\n{{summary}}\n\n## Insights\n{{insights}}',
			prompt: 'Analyze the following journal entry. Provide a concise summary and 3-5 key insights or themes from the text.'
		},
		{
			id: 'gratitude',
			name: 'Gratitude Journal',
			description: 'Focus on gratitude and positive experiences',
			template: '# Gratitude Journal - {{date:YYYY-MM-DD}}\n\n## Voice Note\n{{transcription}}\n\n## What I\'m Grateful For\n{{gratitude_points}}\n\n## Positive Moments\n{{positive_moments}}',
			prompt: 'Extract gratitude statements and positive moments from the journal entry. Format as bullet points.'
		}
	],
	defaultTemplate: 'default',
	transcriptionProvider: 'aiProviders', // Default to AI Providers
	localWhisperEndpoint: 'http://localhost:9000', // Default endpoint for local whisper API
	aiProviders: {
		transcription: null,
		analysis: null,
		mermaidFixer: null
	},
	audioQuality: 'medium',
	automaticSpeechDetection: true,
	transcriptionLanguage: 'auto', // Default to auto language detection
	noteLocation: '/',
	noteNamingFormat: 'Journal/{{date:YYYY/MM/YYYY-MM-DD}}',
	recordingsLocation: '/Recordings',
	appendToExistingNote: false,
	_version: 1
};
