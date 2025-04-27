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
	selectedMicrophoneId?: string; // Optional ID of the selected microphone device

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
			description: 'Standard journal entry with transcription, summary, and insights',
			sections: [
				{
					title: 'Voice Note',
					content: '{{transcription}}',
					prompt: 'Transcribe the following audio.'
				},
				{
					title: 'Summary',
					content: '{{summary}}',
					prompt: 'Summarize the journal entry.'
				},
				{
					title: 'Insights',
					content: '{{insights}}',
					prompt: 'Provide 3-5 key insights or themes from the journal entry.'
				}
			],
		},
		{
			id: 'gratitude',
			name: 'Gratitude Journal',
			description: 'Focus on gratitude and positive experiences',
			sections: [
				{
					title: 'Voice Note',
					content: '{{transcription}}',
					prompt: 'Transcribe the following audio.'
				},
				{
					title: 'Gratitude Points',
					content: '{{gratitude_points}}',
					prompt: 'Extract gratitude statements from the journal entry. Format as bullet points.'
				},
				{
					title: 'Positive Moments',
					content: '{{positive_moments}}',
					prompt: 'Extract positive moments from the journal entry. Format as bullet points.'
				}
			]
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
	selectedMicrophoneId: undefined, // Default to system default microphone
	noteLocation: '/',
	noteNamingFormat: 'Journal/{{date:YYYY/MM/YYYY-MM-DD}}',
	recordingsLocation: '/Recordings',
	appendToExistingNote: false,
	_version: 1
};
