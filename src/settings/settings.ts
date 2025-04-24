import { JournalTemplate } from '../types';

/**
 * Interface for plugin settings
 */
export interface VoiceAIJournalSettings {
	// Template settings
	templates: JournalTemplate[];
	defaultTemplate: string;

	// AI provider settings
	aiProviders: {
		transcription: string | null;
		analysis: string | null;
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
	showRibbonIcon: boolean;
	
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
	aiProviders: {
		transcription: null,
		analysis: null
	},
	audioQuality: 'medium',
	automaticSpeechDetection: true,
	transcriptionLanguage: 'auto', // Default to auto language detection
	noteLocation: '/',
	noteNamingFormat: 'Journal/{{date:YYYY/MM/YYYY-MM-DD}}',
	recordingsLocation: '/Recordings',
	appendToExistingNote: false,
	showRibbonIcon: true,
	_version: 1
};
