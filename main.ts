import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { initAI, waitForAI } from '@obsidian-ai-providers/sdk';

// Import settings and types
import { VoiceAIJournalSettings, DEFAULT_SETTINGS, VoiceAIJournalSettingsTab } from './src/settings';
import { JournalTemplate, AIProviders } from './src/types';

// Import internal modules
import './src/styles.css';

// All interfaces have been moved to src/types.ts

// Settings have been moved to src/settings/settings.ts

export default class VoiceAIJournalPlugin extends Plugin {
	settings: VoiceAIJournalSettings;
	aiProviders: AIProviders | null = null;

	async onload() {
		console.log('Loading Voice AI Journal plugin');

		// Initialize settings
		await this.loadSettings();

		// Initialize AI Providers integration
		initAI(this.app, this, async () => {
			try {
				const aiResolver = await waitForAI();
				this.aiProviders = await aiResolver.promise;
				console.log('AI Providers loaded', this.aiProviders?.providers || 'No providers found');
			} catch (error) {
				console.error('Failed to initialize AI Providers', error);
				new Notice('Voice AI Journal: Failed to initialize AI Providers plugin. Please make sure it is installed and enabled.');
			}

			// Initialize the settings tab
			this.addSettingTab(new VoiceAIJournalSettingsTab(this.app, this));
			
			// Register plugin components after AI is initialized
			this.registerPluginComponents();
		});
	}

	onunload() {
		console.log('Unloading Voice AI Journal plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// This method loads all UI components and registers commands
	async registerPluginComponents() {
		// Import components dynamically to avoid circular dependencies
		const { RecordingModal } = await import('./src/ui/RecordingModal');
		const { TemplateManagerModal } = await import('./src/ui/TemplateEditorModal');

		// Add ribbon icon
		if (this.settings.showRibbonIcon) {
			const ribbonIconEl = this.addRibbonIcon('microphone', 'Voice AI Journal', (evt: MouseEvent) => {
				// Open recording modal when clicked
				if (!this.aiProviders) {
					new Notice('Voice AI Journal: AI Providers plugin not initialized. Please make sure it is installed and enabled.');
					return;
				}
				new RecordingModal(this.app, this).open();
			});
			ribbonIconEl.addClass('voice-ai-journal-ribbon-icon');
		}

		// Register commands
		this.addCommand({
			id: 'start-voice-recording',
			name: 'Start Voice Recording',
			callback: () => {
				if (!this.aiProviders) {
					new Notice('Voice AI Journal: AI Providers plugin not initialized. Please make sure it is installed and enabled.');
					return;
				}
				new RecordingModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'manage-journal-templates',
			name: 'Manage Journal Templates',
			callback: () => {
				new TemplateManagerModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'transcribe-audio-file',
			name: 'Transcribe Audio File',
			checkCallback: (checking: boolean) => {
				// Only enable this command if there's an active file that is an audio file
				const activeFile = this.app.workspace.getActiveFile();
				const isAudioFile = activeFile?.extension && ['mp3', 'wav', 'ogg', 'webm', 'm4a'].includes(activeFile.extension);
				
				if (checking) {
					return !!isAudioFile && !!this.aiProviders;
				}

				if (!this.aiProviders) {
					new Notice('Voice AI Journal: AI Providers plugin not initialized. Please make sure it is installed and enabled.');
					return false;
				}

				if (isAudioFile && activeFile) {
					new Notice(`Transcription of audio files will be implemented in a future version`);
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'generate-mermaid-diagram',
			name: 'Generate Mermaid Diagram from Journal',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (!this.aiProviders) {
					new Notice('Voice AI Journal: AI Providers plugin not initialized. Please make sure it is installed and enabled.');
					return;
				}

				// Get selected text or entire document
				const text = editor.getSelection() || editor.getValue();
				if (!text) {
					new Notice('No text selected or document is empty');
					return;
				}

				new Notice('Generating Mermaid diagram...');
				
				// Import AIManager to avoid circular dependencies
				const { AIManager } = await import('./src/ai/AIManager');
				const aiManager = new AIManager(this.aiProviders);
				
				try {
					const mermaidCode = await aiManager.generateMermaidChart(text, this.settings.aiProviders.analysis);
					
					if (!mermaidCode) {
						new Notice('Failed to generate Mermaid diagram');
						return;
					}

					// Insert the mermaid code block at cursor position
					const mermaidBlock = '```mermaid\n' + mermaidCode + '\n```';
					const cursorPos = editor.getCursor();
					
					// If there's a selection, replace it, otherwise insert at cursor
					if (editor.getSelection()) {
						editor.replaceSelection(mermaidBlock);
					} else {
						editor.replaceRange('\n\n' + mermaidBlock + '\n\n', cursorPos);
					}
					
					new Notice('Mermaid diagram generated successfully');
				} catch (error: unknown) {
					console.error('Error generating Mermaid diagram:', error);
					new Notice(`Failed to generate Mermaid diagram: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		});
	}

	// Method to get template by id
	getTemplateById(id: string): JournalTemplate | undefined {
		return this.settings.templates.find(template => template.id === id);
	}

	// Method to add a new template
	addTemplate(template: JournalTemplate) {
		this.settings.templates.push(template);
		this.saveSettings();
	}

	// Method to update a template
	updateTemplate(templateId: string, updatedTemplate: Partial<JournalTemplate>) {
		const templateIndex = this.settings.templates.findIndex(t => t.id === templateId);
		if (templateIndex >= 0) {
			this.settings.templates[templateIndex] = {
				...this.settings.templates[templateIndex],
				...updatedTemplate
			};
			this.saveSettings();
			return true;
		}
		return false;
	}

	// Method to delete a template
	deleteTemplate(templateId: string) {
		const initialLength = this.settings.templates.length;
		this.settings.templates = this.settings.templates.filter(t => t.id !== templateId);
		
		if (this.settings.templates.length < initialLength) {
			// If the deleted template was the default, set a new default
			if (this.settings.defaultTemplate === templateId && this.settings.templates.length > 0) {
				this.settings.defaultTemplate = this.settings.templates[0].id;
			}
			this.saveSettings();
			return true;
		}
		return false;
	}
}

// Settings tab class has been moved to src/settings/SettingsTab.ts

