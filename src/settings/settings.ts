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
	// Global system message for LLM interactions
	globalSystemPrompt: string;

	// Audio settings
	audioQuality: 'low' | 'medium' | 'high';
	automaticSpeechDetection: boolean;
	transcriptionLanguage: string; // Language for speech recognition
	outputLanguage: string; // Language for LLM responses
	selectedMicrophoneId?: string; // Optional ID of the selected microphone device

	// Journal settings
	noteLocation: string;
	noteNamingFormat: string;
	recordingsLocation: string;
	appendToExistingNote: boolean;

	// UI settings
	includeOptionalSections: boolean;

	// Version tracking
	_version: number;
}

/**
 * Default journal template
 */
export const DEFAULT_JOURNAL_TEMPLATE: JournalTemplate = {
	id: 'default',
	name: 'Default Journal Entry',
	description: 'Standard journal entry with transcription, summary, and insights',
	sections: [
		{
			title: "Summary",
			context: '# Zusammenfassung\n\n{{response}}',
			optional: false,
			prompt: "Think step-by-step: First, analyze the transcript to identify core themes, key points, and actionable takeaways. Second, organize these into a concise, structured summary. Use h3 headers for sub-sections if needed. Format as bullet points with clear, actionable language. Avoid markdown beyond basic lists and headers. Example: '## Summary' followed by '- Key point 1', '- Key point 2'."
		},
		{
			title: "Insights",
			context: '# Erkenntnisse\n\n{{response}}',
			optional: false,
			prompt: "Think deeply: First, reflect on the transcript to identify patterns, contradictions, or opportunities. Second, evaluate how these insights align with your goals. Third, structure your thoughts into a 1-2 paragraph analysis. Finally, add bullet points for actionable improvements. Use h3 headers for sub-sections if needed. Example: '## Key Insight: [Topic]' followed by '### Actionable Improvement: [Detail]'."
		},
		{
			title: "Mermaid Chart",
			context: '```mermaid\n{{response}}\n```',
			optional: false,
			prompt: "Think methodically: First, parse the transcript to identify explicit or implicit questions. Second, formulate answers based on the content and your expertise. Third, structure responses with clear, concise language. Example: 'Q: _Question_ \n Answer'. Avoid assumptions beyond the transcript."
		},
		{
			title: "Answered Questions",
			context: '# Beantwortete Fragen\n\n{{response}}',
			optional: true,
			prompt: "Think methodically: First, parse the transcript to identify explicit or implicit questions. Second, formulate answers based on the content and your expertise. Third, structure responses with clear, concise language. Example: '### Q: Question \n A: Answer'. Avoid assumptions beyond the transcript."
		},
		{
			title: "Todos",
			context: '# Todos\n\n{{response}}',
			optional: true,
			prompt: "Think strategically: First, identify tasks or decisions requiring follow-up. Second, verify each item is actionable (specific, measurable, time-bound). Third, list them in points with priorities. Example: '- [ ] Task (Priority: High, Deadline: Date)'. Avoid vague statements like 'improve performance'; focus on concrete steps."
		}
		/*,
		{
			title: "Reflection",
			context: '# Reflektion\n\n{{response}}',
			optional: true,
			prompt: "Think critically: First, evaluate how the transcript aligns with your goals, challenges, or gaps. Second, reflect on key takeaways. Third, summarize your personal insights. Use h3 headers for sub-sections if needed. Example: '## Key Takeaway: [Summary]' followed by '### Personal Reflection: [Details]'."		
		}*/
	],
};

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: VoiceAIJournalSettings = {
	templates: [
		DEFAULT_JOURNAL_TEMPLATE,
	],
	defaultTemplate: 'default',
	transcriptionProvider: 'aiProviders', // Default to AI Providers
	localWhisperEndpoint: 'http://localhost:9000', // Default endpoint for local whisper API
	aiProviders: {
		transcription: null,
		analysis: null,
		mermaidFixer: null
	},
	globalSystemPrompt: 'You are an AI assistant helping with journal entries. Respond in a helpful and thoughtful manner. Format your responses in clear, well-structured Markdown that will render properly in Obsidian.',
	audioQuality: 'medium',
	automaticSpeechDetection: true,
	transcriptionLanguage: 'auto', // Default to auto language detection
	outputLanguage: 'auto', // Default to auto (use detected language from ASR)
	selectedMicrophoneId: undefined, // Default to system default microphone
	noteLocation: '/',
	noteNamingFormat: 'Journal/{{date:YYYY/MM/YYYY-MM-DD}}',
	recordingsLocation: '/Recordings',
	appendToExistingNote: false,
	includeOptionalSections: true, // Include optional template sections by default
	_version: 1
};
