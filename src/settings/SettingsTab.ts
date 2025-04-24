import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';
import type { AIProvider } from '../types';

/**
 * Settings tab for Voice AI Journal plugin
 */
export class VoiceAIJournalSettingsTab extends PluginSettingTab {
	plugin: VoiceAIJournalPlugin;

	constructor(app: App, plugin: VoiceAIJournalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Load providers from the AI Providers plugin
	 * This is called before displaying settings
	 */
	/**
	 * Get all folders in the vault using the Obsidian API
	 */
	private getFolders(): string[] {
		const folders: string[] = [];
		
		// Function to recursively process all folders
		const processFolder = (folderPath: string) => {
			// Skip root folder as it's added separately
			if (folderPath !== '/') {
				folders.push(folderPath);
			}
			
			// Get all files and folders in this folder
			const abstractFiles = this.app.vault.getRoot().children;
			const folderChildren = this.getFolderChildren(abstractFiles, folderPath);
			
			// Process subfolders recursively
			folderChildren.forEach(child => {
				if (child.children) { // If it has children, it's a folder
					processFolder(child.path);
				}
			});
		};
		
		// Process root folder
		processFolder('/');
		
		// Sort folders alphabetically
		folders.sort();
		
		// Log the found folders for debugging
		console.log('Found folders:', folders);
		
		return folders;
	}
	
	/**
	 * Get children of a specific folder from a list of abstract files
	 */
	private getFolderChildren(abstractFiles: { path: string; children?: any[] }[], folderPath: string): { path: string; children?: any[] }[] {
		if (folderPath === '/') {
			// If root folder, return all top-level folders
			return abstractFiles.filter(file => file.children);
		}
		
		// Find the folder in the abstract files
		for (const file of abstractFiles) {
			if (file.path === folderPath && file.children) {
				return file.children;
			} else if (file.children) {
				// Recursively search in subfolders
				const result = this.getFolderChildren(file.children, folderPath);
				if (result.length > 0) {
					return result;
				}
			}
		}
		
		return [];
	}

	/**
	 * Load providers from the AI Providers plugin
	 * This is called before displaying settings
	 */
	private async loadProviders(): Promise<void> {
		// No-op if AI Providers not initialized
		if (!this.plugin.aiProviders) {
			console.log('AI Providers not available');
			return;
		}

		// Ensure providers exist
		if (!this.plugin.aiProviders.providers || this.plugin.aiProviders.providers.length === 0) {
			console.log('No AI providers found');
			return;
		}

		// This is just to make sure providers are loaded
		console.log(`Found ${this.plugin.aiProviders.providers.length} AI providers`);
	}

	async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Voice AI Journal Settings'});

		// Load AI providers before displaying settings
		await this.loadProviders();
		
		// AI Provider Settings Section
		containerEl.createEl('h3', {text: 'AI Provider Settings'});
		
		if (!this.plugin.aiProviders) {
			new Setting(containerEl)
				.setName('AI Providers Plugin')
				.setDesc('This plugin requires the AI Providers plugin to be installed and configured.')
				.addButton(button => button
					.setButtonText('Open AI Providers Settings')
					.onClick(() => {
						new Notice('Please go to Settings > Community plugins > AI Providers > Settings to configure the AI integration.');
					}));
		} else {
			// Model selection for transcription
			new Setting(containerEl)
				.setName('Transcription Provider')
				.setDesc('Select the AI provider to use for voice transcription')
				.addDropdown(dropdown => {
					// Add default empty option
					dropdown.addOption('', 'Select a provider');
					
					// Add all available providers
					if (this.plugin.aiProviders && this.plugin.aiProviders.providers) {
						this.plugin.aiProviders.providers.forEach((provider: AIProvider) => {
							dropdown.addOption(provider.id, `${provider.name} (${provider.model})`);
						});
					}
					
					// Set the selected value if exists
					dropdown.setValue(this.plugin.settings.aiProviders.transcription || '');
					
					dropdown.onChange(async (value) => {
						this.plugin.settings.aiProviders.transcription = value || null;
						await this.plugin.saveSettings();
					});
				});
			
			// Model selection for analysis
			new Setting(containerEl)
				.setName('Analysis Provider')
				.setDesc('Select the AI provider to use for journal analysis')
				.addDropdown(dropdown => {
					// Add default empty option
					dropdown.addOption('', 'Select a provider');
					
					// Add all available providers
					if (this.plugin.aiProviders && this.plugin.aiProviders.providers) {
						this.plugin.aiProviders.providers.forEach((provider: AIProvider) => {
							dropdown.addOption(provider.id, `${provider.name} (${provider.model})`);
						});
					}
					
					// Set the selected value if exists
					dropdown.setValue(this.plugin.settings.aiProviders.analysis || '');
					
					dropdown.onChange(async (value) => {
						this.plugin.settings.aiProviders.analysis = value || null;
						await this.plugin.saveSettings();
					});
				});
				
			// Providers will automatically load when settings tab is opened
		}

		// Note Location Settings
		containerEl.createEl('h3', {text: 'Journal Notes Settings'});

		new Setting(containerEl)
			.setName('Note Location')
			.setDesc('Where to save your journal entries')
			.addDropdown(dropdown => {
				// Add root folder option
				dropdown.addOption('/', 'Vault root folder');
				
				// Get the latest folders from the vault
				const folders = this.getFolders();
				console.log('Populating dropdown with folders:', folders.length);
				
				// Add all found folders
				folders.forEach(folder => {
					dropdown.addOption(folder, folder);
				});
				
				// Set current value
				const currentValue = this.plugin.settings.noteLocation || '/';
				console.log('Setting current folder value:', currentValue);
				dropdown.setValue(currentValue);
				
				// Handle change
				dropdown.onChange(async (value) => {
					console.log('Folder changed to:', value);
					this.plugin.settings.noteLocation = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Recordings Location')
			.setDesc('Where to save your audio recordings (mp3/m4a files)')
			.addDropdown(dropdown => {
				// Add root folder option
				dropdown.addOption('/', 'Vault root folder');
				
				// Get the latest folders from the vault
				const folders = this.getFolders();
				
				// Add all found folders
				folders.forEach(folder => {
					dropdown.addOption(folder, folder);
				});
				
				// Set current value
				const currentValue = this.plugin.settings.recordingsLocation || '/Recordings';
				dropdown.setValue(currentValue);
				
				// Handle change
				dropdown.onChange(async (value) => {
					this.plugin.settings.recordingsLocation = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Note Naming Format')
			.setDesc('Format for naming new journal entries. Use {{date:YYYY-MM-DD}} for date formatting.')
			.addText(text => text
				.setPlaceholder('Journal/{{date:YYYY/MM/YYYY-MM-DD}}')
				.setValue(this.plugin.settings.noteNamingFormat)
				.onChange(async (value) => {
					this.plugin.settings.noteNamingFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Append to Existing Note')
			.setDesc('If a note with the same name exists, append to it instead of creating a new one')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.appendToExistingNote)
				.onChange(async (value) => {
					this.plugin.settings.appendToExistingNote = value;
					await this.plugin.saveSettings();
				}));

		// Recording Settings
		containerEl.createEl('h3', {text: 'Recording Settings'});

		new Setting(containerEl)
			.setName('Audio Quality')
			.setDesc('Higher quality results in larger files but better transcription')
			.addDropdown(dropdown => dropdown
				.addOption('low', 'Low')
				.addOption('medium', 'Medium')
				.addOption('high', 'High')
				.setValue(this.plugin.settings.audioQuality)
				.onChange(async (value: 'low' | 'medium' | 'high') => {
					this.plugin.settings.audioQuality = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Automatic Speech Detection')
			.setDesc('Automatically pause recording when no speech is detected')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.automaticSpeechDetection)
				.onChange(async (value) => {
					this.plugin.settings.automaticSpeechDetection = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Transcription Language')
			.setDesc('Select the language for speech recognition (default: auto-detect)')
			.addDropdown(dropdown => {
				// Add auto-detect option
				dropdown.addOption('auto', 'Auto-detect language');
				
				// Add all Whisper supported languages
				const languages = [
					{ code: 'en', name: 'English' },
					{ code: 'zh', name: 'Chinese' },
					{ code: 'de', name: 'German' },
					{ code: 'es', name: 'Spanish' },
					{ code: 'ru', name: 'Russian' },
					{ code: 'ko', name: 'Korean' },
					{ code: 'fr', name: 'French' },
					{ code: 'ja', name: 'Japanese' },
					{ code: 'pt', name: 'Portuguese' },
					{ code: 'tr', name: 'Turkish' },
					{ code: 'pl', name: 'Polish' },
					{ code: 'ca', name: 'Catalan' },
					{ code: 'nl', name: 'Dutch' },
					{ code: 'ar', name: 'Arabic' },
					{ code: 'sv', name: 'Swedish' },
					{ code: 'it', name: 'Italian' },
					{ code: 'id', name: 'Indonesian' },
					{ code: 'hi', name: 'Hindi' },
					{ code: 'fi', name: 'Finnish' },
					{ code: 'vi', name: 'Vietnamese' },
					{ code: 'he', name: 'Hebrew' },
					{ code: 'uk', name: 'Ukrainian' },
					{ code: 'el', name: 'Greek' },
					{ code: 'ms', name: 'Malay' },
					{ code: 'cs', name: 'Czech' },
					{ code: 'ro', name: 'Romanian' },
					{ code: 'da', name: 'Danish' },
					{ code: 'hu', name: 'Hungarian' },
					{ code: 'ta', name: 'Tamil' },
					{ code: 'no', name: 'Norwegian' },
					{ code: 'th', name: 'Thai' },
					{ code: 'ur', name: 'Urdu' },
					{ code: 'hr', name: 'Croatian' },
					{ code: 'bg', name: 'Bulgarian' },
					{ code: 'lt', name: 'Lithuanian' },
					{ code: 'la', name: 'Latin' },
					{ code: 'mi', name: 'Maori' },
					{ code: 'ml', name: 'Malayalam' },
					{ code: 'cy', name: 'Welsh' },
					{ code: 'sk', name: 'Slovak' },
					{ code: 'te', name: 'Telugu' },
					{ code: 'fa', name: 'Persian' },
					{ code: 'lv', name: 'Latvian' },
					{ code: 'bn', name: 'Bengali' },
					{ code: 'sr', name: 'Serbian' },
					{ code: 'az', name: 'Azerbaijani' },
					{ code: 'sl', name: 'Slovenian' },
					{ code: 'kn', name: 'Kannada' },
					{ code: 'et', name: 'Estonian' },
					{ code: 'mk', name: 'Macedonian' },
					{ code: 'br', name: 'Breton' },
					{ code: 'eu', name: 'Basque' },
					{ code: 'is', name: 'Icelandic' },
					{ code: 'hy', name: 'Armenian' },
					{ code: 'ne', name: 'Nepali' },
					{ code: 'mn', name: 'Mongolian' },
					{ code: 'bs', name: 'Bosnian' },
					{ code: 'kk', name: 'Kazakh' },
					{ code: 'sq', name: 'Albanian' },
					{ code: 'sw', name: 'Swahili' },
					{ code: 'gl', name: 'Galician' },
					{ code: 'mr', name: 'Marathi' },
					{ code: 'pa', name: 'Punjabi' },
					{ code: 'si', name: 'Sinhala' },
					{ code: 'km', name: 'Khmer' },
					{ code: 'sn', name: 'Shona' },
					{ code: 'yo', name: 'Yoruba' },
					{ code: 'so', name: 'Somali' },
					{ code: 'af', name: 'Afrikaans' },
					{ code: 'oc', name: 'Occitan' },
					{ code: 'ka', name: 'Georgian' },
					{ code: 'be', name: 'Belarusian' },
					{ code: 'tg', name: 'Tajik' },
					{ code: 'sd', name: 'Sindhi' },
					{ code: 'gu', name: 'Gujarati' },
					{ code: 'am', name: 'Amharic' },
					{ code: 'yi', name: 'Yiddish' },
					{ code: 'lo', name: 'Lao' },
					{ code: 'uz', name: 'Uzbek' },
					{ code: 'fo', name: 'Faroese' },
					{ code: 'ht', name: 'Haitian Creole' },
					{ code: 'ps', name: 'Pashto' },
					{ code: 'tk', name: 'Turkmen' },
					{ code: 'nn', name: 'Nynorsk' },
					{ code: 'mt', name: 'Maltese' },
					{ code: 'sa', name: 'Sanskrit' },
					{ code: 'lb', name: 'Luxembourgish' },
					{ code: 'my', name: 'Myanmar' },
					{ code: 'bo', name: 'Tibetan' },
					{ code: 'tl', name: 'Tagalog' },
					{ code: 'mg', name: 'Malagasy' },
					{ code: 'as', name: 'Assamese' },
					{ code: 'tt', name: 'Tatar' },
					{ code: 'haw', name: 'Hawaiian' },
					{ code: 'ln', name: 'Lingala' },
					{ code: 'ha', name: 'Hausa' },
					{ code: 'ba', name: 'Bashkir' },
					{ code: 'jw', name: 'Javanese' },
					{ code: 'su', name: 'Sundanese' },
				];
				
				// Sort languages alphabetically by name
				languages.sort((a, b) => a.name.localeCompare(b.name));
				
				// Add all languages to the dropdown
				languages.forEach(lang => {
					dropdown.addOption(lang.code, lang.name);
				});
				
				// Set the current value
				dropdown.setValue(this.plugin.settings.transcriptionLanguage);
				
				// Save changes when selection changes
				dropdown.onChange(async (value) => {
					this.plugin.settings.transcriptionLanguage = value;
					await this.plugin.saveSettings();
				});
			});

		// UI Settings
		containerEl.createEl('h3', {text: 'User Interface'});

		new Setting(containerEl)
			.setName('Show Ribbon Icon')
			.setDesc('Show Voice AI Journal icon in the ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();
					// Force reload the plugin to update ribbon
					this.plugin.onunload();
					this.plugin.onload();
				}));

		// Template Management (simplified, we'll enhance this with a separate UI component later)
		containerEl.createEl('h3', {text: 'Templates'});

		new Setting(containerEl)
			.setName('Default Template')
			.setDesc('Choose the default template for new journal entries')
			.addDropdown(dropdown => {
				// Add all templates to the dropdown
				this.plugin.settings.templates.forEach(template => {
					dropdown.addOption(template.id, template.name);
				});
				
				dropdown.setValue(this.plugin.settings.defaultTemplate)
				.onChange(async (value) => {
					this.plugin.settings.defaultTemplate = value;
					await this.plugin.saveSettings();
				});
			});

		// We'll add template editing UI here in future iterations
	}
}
