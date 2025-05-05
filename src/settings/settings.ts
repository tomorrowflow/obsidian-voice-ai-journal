import { JournalTemplate } from '../types';

/**
 * Interface for plugin settings
 */
export interface VoiceAIJournalSettings {
	transcriptsLocation: string; // Folder to store transcript markdown files
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
	transcriptionLanguage: string; // Language for speech recognition
	outputLanguage: string; // Language for LLM responses
	selectedMicrophoneId?: string; // Optional ID of the selected microphone device

	// Journal settings
	noteLocation: string;
	noteNamingFormat: string;
	recordingsLocation: string;
	appendToExistingNote: boolean;

	// Tag settings
	tagExtractionPrompt: string; // Prompt for extracting tags from transcription

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
			context: '# Zusammenfassung\n\n{{response}}\n',
			optional: false,
			prompt: "Think step-by-step: First, analyze the transcript to identify core themes, key points, and actionable takeaways. Second, organize these into a concise, structured summary. Use h2 headers for sub-sections. Format as bullet points with clear, actionable language. Avoid markdown beyond basic lists and headers. Do not add a general headline. Example (to be translated into target language): '## Digest' followed by '- Key point 1', '- Key point 2'. "
		},
		{
			title: "Insights",
			context: '# Erkenntnisse\n\n{{response}}\n',
			optional: false,
			prompt: "Think deeply: First, reflect on the transcript to identify patterns, contradictions, or opportunities. Second, evaluate how these insights align with your goals. Third, structure your thoughts into a 1-2 paragraph analysis. Finally, add bullet points for actionable improvements. Use h3 headers for sub-sections if needed. Example (to be translated into target language): '## Key Insight: [Topic]' followed by '### Actionable Improvement: [Detail]'."
		},
		{
			title: "Mermaid Chart",
			context: '# Mermaid Diagramm\n\n```mermaid\n{{response}}\n```\n',
			optional: false,
			prompt: "Think critically: First, map relationships between key concepts in the transcript and your insights. Second, decide on a top-down structure with nodes. The chart should visually connect key concepts, insights, and statements from the speaker. Third, write the Mermaid code using the 'graph TD' syntax. Employ a colorful style for better readability. Stay within the Obsidian color pallette: #71627a, #5b4965, #3d354b, #2e293a, #2e293a, #064273, #76b6c4, #7fcdff, #1da2d8, #def3f6. **Crucially, ONLY output the Mermaid chart code itself. Do not include any surrounding text or markdown formatting.**  **Strictly avoid the following characters within node labels:** newlines, tabs, commas, apostrophes, quotes, and any special characters that could break the Mermaid syntax. If a quote is necessary, represent it as `#quot;`.  The chart should be concise and easy to understand."
		},
		{
			title: "Answered Questions",
			context: '# Beantwortete Fragen\n\n{{response}}\n',
			optional: true,
			prompt: "Think methodically, if and only if the user says \"Hey Voice AI\" or alludes to you, asking you to do something, answer the question or do the ask and put the answers here: First, parse the transcript to identify explicit or implicit questions. Second, formulate answers based on the content and your expertise. Third, structure responses with clear, concise language. Example: '_Question_ \nAnswer'. Avoid assumptions beyond the transcript."
		},
		{
			title: "Todos",
			context: '# Todos\n\n{{response}}\n',
			optional: true,
			prompt: "Think strategically: First, identify tasks or decisions requiring follow-up. Second, verify each item is actionable (specific, measurable, time-bound). Third, list them in points with priorities. The response should be in the format of a list of tasks, no additional text or comments: '- [ ] Task (Priority: High, Deadline: Date)'. Avoid vague statements like 'improve performance'; focus on concrete steps."
		}
		/*,
		{
			title: "Reflection",
			context: '# Reflektion\n\n{{response}}\n',
			optional: true,
			prompt: "Think critically: First, evaluate how the transcript aligns with your goals, challenges, or gaps. Second, reflect on key takeaways. Third, summarize your personal insights. Use h3 headers for sub-sections if needed. Do not add a general headline. Example (to be translated into target language): '## Key Takeaway: [Summary]' followed by '### Personal Reflection: [Details]'."		
		}*/
	],
};

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: VoiceAIJournalSettings = {
	transcriptsLocation: '/Transcripts',
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
	tagExtractionPrompt: 'You are a helpful assistant that analyzes text and extracts relevant keywords or tags. Extract up to 8 keywords from the given text. Return only the keywords as a JSON array of strings. Make sure the keywords are relevant, specific, and useful for categorizing the content.\n\n*Tag format* \nTags must not start with a #, since we use them in the properties. You can use any of the following characters in your tags:\n\nAlphabetical letters\nNumbers\nUnderscore (_)\nHyphen (-)\nForward slash (/) for Nested tags\nTags must contain at least one non-numerical character. For example, 1984 or 01.01.1970 aren\'t a valid tags, but y1984 is.\n\nTags are case-insensitive. For example, tag and TAG will be treated as identical.\n\nTags can\'t contain blank spaces. To separate two or more words, you can instead use the following formats:\n\ncamelCase\nPascalCase\nsnake_case\nkebab-case',
	globalSystemPrompt: 'You are a meticulous and insightful AI assistant specializing in crafting reflective journal entries. Your primary goal is to help users process and document their experiences in a clear, organized, and personally meaningful way. **Your responses _must_ be perfectly formatted Markdown, intended for seamless rendering in Obsidian (or any other Markdown editor).**\n\n**Critical Formatting Requirements:**\n\n*   **Strict Markdown Syntax:** _All_ output _must_ adhere to standard Markdown syntax. This is paramount.\n*   **Whitespace Control:** Pay extremely close attention to whitespace.\n    *   **Lists:**  **Use _exactly_ one space** after the list marker (`*`, `-`, `1.`, `2.`, etc.). **Do _not_ use more than one space.** This is critical for proper rendering in Obsidian.  Absolutely no extra spaces are permitted after the list marker.\n    *   **Headings:** Use a single `#` for H1, `##` for H2, and so on. Ensure a space follows the `#` symbols.\n    *   **Code Blocks:** Code blocks are _not_ permitted.\n    *   **Emphasis:** Use single asterisks (`*`) or underscores (`_`) for _italics_, and double asterisks (`**`) or underscores (`__`) for **bold**. Avoid excessive or inconsistent use.\n*   **No Fencing:** Do not use any code fencing (e.g., ```markdown ```, ```text ```). Output only the formatted Markdown content.\n*   **No Introductory/Concluding Statements:** Output only the Markdown itself. Do not include any surrounding text, explanations, or framing.\n\n**These are examples for the desired syntax**\nHeaders:\n# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n\nEmphasis:\n- _italic text_\n- **bold text**\n- _**bold italic text**_\n- ~~strikethrough text~~\n\nLists:\n- Unordered:\n    - Item 1\n    - Item 2\n- Ordered:\n    1. Item 1\n    2. Item 2\n\nBlockquotes:\n> This is a blockquote.\n\nHorizontal Rule / Separator:\n---\n\nLinks:\n[link text](https://example.com/)\n\nCode:\n- Inline: `code`\n- Block:\n````\ncode\n````\n\nFootnotes `[^1]`:\n[^1]: This is a footnote.\n\nTasks `[x]`:\n- [x] Task completed\n- [ ] Task not completed\n\nTables:\n| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n\n\n**Content and Tone Guidelines:**\n\n*   **Third-Person Perspective:** Do not respond as the individual whose experiences are being documented. Maintain an objective, analytical tone. Avoid using \"I,\" \"you,\" or other personal pronouns.\n*   **Precise Explanations:** Provide clear and accurate summaries of information.\n*   **Thematic Focus:** Identify key themes and patterns within the provided text.\n*   **Concise Writing:** Write in a clear, concise, and organized manner.  Avoid unnecessary wordiness. STICK precisely to the user prompt and do not elaborate or add additional text, *there is especially no need to add any additional diary context.* Only add reflexion or emotions when explicitly asked for by the user role.',
	audioQuality: 'medium',
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
