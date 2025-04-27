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
 * Default journal template
 */
export const DEFAULT_JOURNAL_TEMPLATE: JournalTemplate = {
	id: 'default',
	name: 'Default Journal Entry',
	description: 'Standard journal entry with transcription, summary, and insights',
	sections: [
		{
			title: "Summary",
			context: '{{transcription}}',
			optional: false,
			prompt: "You are a professional business analyst summarizing a transcript of a business discussion.  Provide a concise summary of the key points discussed in Markdown format.  Use bullet points for clarity. Focus on actionable information and decisions made.  Use `<h2>` for the section header and smaller headers (`<h3>`, `<h4>`) for subtopics within the summary. Limit the summary to approximately 150-200 words.",
		},
		{
			title: "Insights",
			context: '{{transcription}}',
			optional: false,
			prompt: "You are a strategic business advisor.  Analyze the transcript and identify key insights and potential improvements.  Present your insights in Markdown format. Start with a short paragraph (2-3 sentences) summarizing the overall themes. Follow this with bullet points detailing specific insights and suggested enhancements.  Include potential areas for follow-up or further investigation. Use `<h2>` for the section header and smaller headers for subtopics.  Limit the insights section to around 200-250 words.",
		},
		{
			title: "Mermaid Chart",
			context: '```mermaid\n{{transcription}}\n```',
			optional: false,
			prompt: "Generate a valid Unicode Mermaid chart representing a concept map derived from the transcript. The chart should visually connect key concepts, insights, and statements from the speaker. Use a top-down structure for clarity. Employ a colorful style for better readability.  **Crucially, ONLY output the Mermaid chart code itself. Do not include any surrounding text or markdown formatting.**  **Strictly avoid the following characters within node labels:** newlines, tabs, commas, apostrophes, quotes, and any special characters that could break the Mermaid syntax. If a quote is necessary, represent it as `#quot;`.  The chart should be concise and easy to understand.",
		},
		{
			title: "Answered Questions",
			context: '{{transcription}}',
			optional: true,
			prompt: "If the transcript contains direct questions or requests addressed to you (the AI assistant), summarize each question in a concise heading (using `<h3>` or `<h4>`).  Immediately below each question heading, provide a clear and concise answer or response, formatted in Markdown.  Maintain a conversational and helpful tone. If no questions are present, this section should remain empty.",
		},
		{
			title: "Todos",
			context: '{{transcription}}',
			optional: true,
			prompt: "Extract all actionable tasks, follow-up items, or commitments mentioned in the transcript. Present these as a Markdown checklist (e.g., `- [ ] Task description`).  Only include items that are clearly defined and require specific action.  If no actionable tasks are found, output the following text: 'No actionable tasks identified in this transcript.'",
		}
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
