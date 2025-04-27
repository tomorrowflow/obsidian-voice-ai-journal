import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';
import type { AIProvider, JournalTemplate } from '../types';
import { DEFAULT_JOURNAL_TEMPLATE } from './settings';

/**
 * Settings tab for Voice AI Journal plugin with tabbed interface
 */
export class VoiceAIJournalSettingsTab extends PluginSettingTab {
	plugin: VoiceAIJournalPlugin;
	private activeTab: 'general' | 'templates' = 'general';
	private selectedTemplateId: string | null = null;

	constructor(app: App, plugin: VoiceAIJournalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		
		// Add CSS class for styling
		containerEl.addClass('voice-journal-settings');
		
		// Add main headline above tabs
		containerEl.createEl('h3', { text: 'Voice AI Journal Settings' });
		
		// Create tab header
		const tabHeaderEl = containerEl.createEl('div', { cls: 'voice-journal-tab-header' });
		
		// Create tab buttons
		const generalTabBtn = tabHeaderEl.createEl('button', { 
			text: 'General', 
			cls: this.activeTab === 'general' ? 'voice-journal-tab-active' : ''
		});
		const templatesTabBtn = tabHeaderEl.createEl('button', { 
			text: 'Templates', 
			cls: this.activeTab === 'templates' ? 'voice-journal-tab-active' : ''
		});
		
		// Add click handlers
		generalTabBtn.onclick = () => {
			this.activeTab = 'general';
			this.display();
		};
		
		templatesTabBtn.onclick = () => {
			this.activeTab = 'templates';
			this.display();
		};
		
		// Create content container
		const contentEl = containerEl.createEl('div', { cls: 'voice-journal-tab-content' });
		
		// Show active tab content
		if (this.activeTab === 'general') {
			this.renderGeneralTab(contentEl);
		} else {
			this.renderTemplatesTab(contentEl);
		}
		
		// Add CSS to style the tabs
		this.addStyles(); // Add styles for the settings tab
	}

	/**
	 * Render the General settings tab
	 */
	private async renderGeneralTab(containerEl: HTMLElement): Promise<void> {
		containerEl.empty();

		// Load AI Providers
		// No-op: loadProviders removed

		// Audio Settings Section first
		containerEl.createEl('h3', { text: 'Audio & Recording Settings' });

		// Audio quality selection
		new Setting(containerEl)
			.setName('Audio Quality')
			.setDesc('Higher quality records more data but creates larger files')
			.addDropdown(dropdown => {
				dropdown.addOption('low', 'Low (8kHz, mono)')
				dropdown.addOption('medium', 'Medium (16kHz, mono)')
				dropdown.addOption('high', 'High (44.1kHz, stereo)')
				
				dropdown.setValue(this.plugin.settings.audioQuality);
				
				dropdown.onChange(async (value: 'low' | 'medium' | 'high') => {
					this.plugin.settings.audioQuality = value;
					await this.plugin.saveSettings();
				});
			});

		// Automatic speech detection toggle
		new Setting(containerEl)
			.setName('Automatic Speech Detection')
			.setDesc('Automatically start/stop recording based on speech detection')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.automaticSpeechDetection);
				
				toggle.onChange(async (value: boolean) => {
					this.plugin.settings.automaticSpeechDetection = value;
					await this.plugin.saveSettings();
				});
			});

		// Microphone selection
		new Setting(containerEl)
			.setName('Microphone')
			.setDesc('Select which microphone to use for recording')
			.addDropdown(async dropdown => {
				// Add auto option
				dropdown.addOption('', 'System Default');
				
				try {
					// Get available devices if browser supports it
					if (navigator && navigator.mediaDevices) {
						const devices = await navigator.mediaDevices.enumerateDevices();
						const audioInputs = devices.filter(device => device.kind === 'audioinput');
						
						audioInputs.forEach(device => {
							dropdown.addOption(device.deviceId, device.label || `Microphone (${device.deviceId.slice(0, 5)}...)`);
						});
					}
				} catch (error) {
					console.error('Error listing audio devices:', error);
				}
				
				dropdown.setValue(this.plugin.settings.selectedMicrophoneId || '');
				
				dropdown.onChange(async (value: string) => {
					this.plugin.settings.selectedMicrophoneId = value || undefined;
					await this.plugin.saveSettings();
				});
			});

		// AI Provider Settings Section
		containerEl.createEl('h3', { text: 'Transcription & AI Settings' });

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
			// Transcription source selection (AI Providers vs Local Whisper)
			new Setting(containerEl)
				.setName('Transcription Source')
				.setDesc('Choose between AI Providers plugin or local Whisper server for transcription')
				.addDropdown(dropdown => {
					dropdown.addOption('aiProviders', 'AI Providers Plugin');
					dropdown.addOption('localWhisper', 'Local Whisper API');
					
					dropdown.setValue(this.plugin.settings.transcriptionProvider);
					
					dropdown.onChange(async (value: 'aiProviders' | 'localWhisper') => {
						this.plugin.settings.transcriptionProvider = value;
						await this.plugin.saveSettings();
						
						// Force refresh settings display to show/hide relevant options
						this.display();
					});
				});
				
			// Local Whisper endpoint (only shown when local Whisper is selected)
			if (this.plugin.settings.transcriptionProvider === 'localWhisper') {
				new Setting(containerEl)
					.setName('Local Whisper Endpoint')
					.setDesc('URL for your local Whisper ASR webservice (see https://github.com/ahmetoner/whisper-asr-webservice)')
					.addText(text => text
						.setPlaceholder('http://localhost:9000')
						.setValue(this.plugin.settings.localWhisperEndpoint)
						.onChange(async (value) => {
							this.plugin.settings.localWhisperEndpoint = value;
							await this.plugin.saveSettings();
						}));
			}
			
			// AI Provider Transcription selection (only shown when AI Providers is selected)
			if (this.plugin.settings.transcriptionProvider === 'aiProviders') {
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
						
						dropdown.onChange(async (value: string) => {
							this.plugin.settings.aiProviders.transcription = value;
							await this.plugin.saveSettings();
						});
					});
			}

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
					
					dropdown.onChange(async (value: string) => {
						this.plugin.settings.aiProviders.analysis = value || null;
						await this.plugin.saveSettings();
					});
				});

			// Mermaid fixer provider for diagrams
			new Setting(containerEl)
				.setName('Mermaid Fixer Provider')
				.setDesc('Select the AI provider to use for fixing Mermaid diagrams (optional)')
				.addDropdown(dropdown => {
					// Add default empty option
					dropdown.addOption('', 'None/Disabled');
					
					// Add all available providers
					if (this.plugin.aiProviders && this.plugin.aiProviders.providers) {
						this.plugin.aiProviders.providers.forEach((provider: AIProvider) => {
							dropdown.addOption(provider.id, `${provider.name} (${provider.model})`);
						});
					}
					
					// Set the selected value if exists
					dropdown.setValue(this.plugin.settings.aiProviders.mermaidFixer || '');
					
					dropdown.onChange(async (value: string) => {
						this.plugin.settings.aiProviders.mermaidFixer = value || null;
						await this.plugin.saveSettings();
					});
				});
		}

		// Transcription language selection
		new Setting(containerEl)
			.setName('Transcription Language')
			.setDesc('Language for speech recognition (auto will attempt to detect language)')
			.addDropdown(dropdown => {
				// Add common languages
				dropdown.addOption('auto', 'Auto detect')
				dropdown.addOption('en', 'English')
				dropdown.addOption('fr', 'French')
				dropdown.addOption('de', 'German')
				dropdown.addOption('es', 'Spanish')
				dropdown.addOption('it', 'Italian')
				dropdown.addOption('pt', 'Portuguese')
				dropdown.addOption('nl', 'Dutch')
				dropdown.addOption('ja', 'Japanese')
				dropdown.addOption('zh', 'Chinese')
				dropdown.addOption('ko', 'Korean')
				dropdown.addOption('ru', 'Russian')
				
				dropdown.setValue(this.plugin.settings.transcriptionLanguage);
				
				dropdown.onChange(async (value: string) => {
					this.plugin.settings.transcriptionLanguage = value;
					await this.plugin.saveSettings();
				});
			});

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
				folders.forEach((folder: string) => {
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
				folders.forEach((folder: string) => {
					dropdown.addOption(folder, folder);
				});
				
				// Set current value
				const currentValue = this.plugin.settings.recordingsLocation || '/';
				dropdown.setValue(currentValue);
				
				// Handle change
				dropdown.onChange(async (value) => {
					this.plugin.settings.recordingsLocation = value;
					await this.plugin.saveSettings();
				});
			});

		// Note naming format
		new Setting(containerEl)
			.setName('Note Naming Format')
			.setDesc('Format for naming new journal notes. Use {{date:FORMAT}} for date variables.')
			.addText(text => {
				text.setValue(this.plugin.settings.noteNamingFormat);
				text.setPlaceholder('Journal/{{date:YYYY/MM/YYYY-MM-DD}}');
				
				text.onChange(async (value) => {
					this.plugin.settings.noteNamingFormat = value;
					await this.plugin.saveSettings();
				});
			});

		// Append to existing note toggle
		new Setting(containerEl)
			.setName('Append to Existing Note')
			.setDesc('If a note with the same name exists, append the new entry instead of creating a new file')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.appendToExistingNote);
				
				toggle.onChange(async (value) => {
					this.plugin.settings.appendToExistingNote = value;
					await this.plugin.saveSettings();
				});
			});
	}

	/**
	 * Render the Templates tab
	 */
	private renderTemplatesTab(containerEl: HTMLElement): void {
		containerEl.empty();
		containerEl.createEl('h3', { text: 'Journal Templates' });

        // Ensure templates array exists and always include the default template if missing
        let templates = Array.isArray(this.plugin.settings.templates) ? [...this.plugin.settings.templates] : [];
        if (!templates.some(t => t.id === DEFAULT_JOURNAL_TEMPLATE.id)) {
            templates = [DEFAULT_JOURNAL_TEMPLATE, ...templates];
        }
        // Get template IDs and names
        const templateIds = templates.map((t: JournalTemplate) => t.id);
        const templateNames = templates.map((t: JournalTemplate) => t.name);

        // Set initial selected template
        if (!this.selectedTemplateId || !templateIds.includes(this.selectedTemplateId)) {
            this.selectedTemplateId = templateIds.length > 0 ? templateIds[0] : null;
        }

        // Default template setting
        new Setting(containerEl)
            .setName('Default Template')
            .setDesc('The template that will be selected by default when creating a new entry')
            .addDropdown(dropdown => {
                // Add template options
                if (templates.length === 0) {
                    dropdown.addOption('', 'No templates available');
                } else {
                    templateIds.forEach((id, index) => {
                        dropdown.addOption(id, templateNames[index]);
                    });
                }
                // Set current value
                dropdown.setValue(this.plugin.settings.defaultTemplate || '');
                // Handle change
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultTemplate = value;
                    await this.plugin.saveSettings();
                });
            });
            
        // Add a visual separator that matches other settings sections
        containerEl.createEl('h3', { text: 'Template Management' });

        // Add new template button
        const newTemplateContainer = containerEl.createEl('div', { cls: 'voice-journal-new-template' });
        new Setting(newTemplateContainer)
            .setName('Create New Template')
            .setDesc('Add a new journal template')
            .addButton(button => {
                button.setButtonText('Add Template')
                    .setCta()
                    .onClick(async () => {
                        // Create a new template with default values
                        const newTemplate: JournalTemplate = {
                            id: `template-${Date.now()}`,
                            name: 'New Template',
                            description: 'A new journal template',
                            sections: [
                                {
                                    title: 'Voice Note',
                                    content: '{{transcription}}',
                                    prompt: 'Transcribe the following audio.',
                                    optional: false
                                },
                                {
                                    title: 'Thoughts',
                                    content: '{{thoughts}}',
                                    prompt: 'Analyze the journal entry and extract thoughts.',
                                    optional: false
                                }
                            ],
                        };
                        await this.plugin.addTemplate(newTemplate);
                        this.selectedTemplateId = newTemplate.id;
                        this.renderTemplatesTab(containerEl);
                    });
            })
            .addButton(button => {
                button.setButtonText('Clone Template')
                    .onClick(async () => {
                        // Find the template to clone (from the default template dropdown)
                        const sourceTemplateId = this.plugin.settings.defaultTemplate;
                        const sourceTemplate = templates.find(t => t.id === sourceTemplateId);
                        
                        if (sourceTemplate) {
                            // Create a deep copy of the source template
                            const clonedTemplate: JournalTemplate = {
                                id: `template-${Date.now()}`,
                                name: `${sourceTemplate.name} (Copy)`,
                                description: sourceTemplate.description,
                                sections: JSON.parse(JSON.stringify(sourceTemplate.sections || [])),
                            };
                            
                            await this.plugin.addTemplate(clonedTemplate);
                            this.selectedTemplateId = clonedTemplate.id;
                            this.renderTemplatesTab(containerEl);
                        } else {
                            // Show error if no template is selected
                            new Notice('Please select a template to clone in the Default Template dropdown');
                        }
                    });
            });

        // Template selector
        if (templates.length > 0) {
            new Setting(containerEl)
                .setName('Edit Template')
                .setDesc('Select a template to edit')
                .addDropdown(dropdown => {
                    templateIds.forEach((id, index) => {
                        dropdown.addOption(id, templateNames[index]);
                    });
                    dropdown.setValue(this.selectedTemplateId || '');
                    dropdown.onChange((value) => {
                        this.selectedTemplateId = value;
                        this.renderTemplatesTab(containerEl); // Refresh to show selected template
                });
            });
    } else {
        containerEl.createEl('p', { text: 'No templates found. Create your first template below.' });
    }

    // Template editor
    if (this.selectedTemplateId) {
        const template = templates.find((t: JournalTemplate) => t.id === this.selectedTemplateId);
        if (template) {
            const templateEl = containerEl.createEl('div', { cls: 'voice-journal-template-editor' });
            // Make template name editable with bold h2-style label
            new Setting(templateEl)
                .setName('Template Name')
                .setClass('template-name-setting')
                .then(setting => {
                    // Style the setting name to look like h2
                    const nameEl = setting.nameEl;
                    nameEl.style.fontWeight = 'bold';
                    nameEl.style.fontSize = 'var(--h4-size)';
                    nameEl.style.marginBottom = '0.4em';
                })
                .addText(text => {
                    text.setValue(template.name)
                        .onChange(async (value) => {
                            template.name = value;
                            await this.plugin.saveSettings();
                        });
                    // Make the input field wider
                    text.inputEl.style.width = '100%';
                });
                
            // Add button to add more sections (below template name)
            new Setting(templateEl)
                .setName('Add Section')
                .setDesc('Add a new section to this template')
                .addButton(button => {
                    button.setButtonText('Add Section')
                        .setCta()
                        .onClick(async () => {
                            // Create a new section with default values
                            if (!Array.isArray(template.sections)) {
                                template.sections = [];
                            }
                            template.sections.push({
                                title: 'New Section',
                                content: '',
                                prompt: '',
                                optional: false
                            });
                            await this.plugin.saveSettings();
                            this.renderTemplatesTab(containerEl);
                        });
                });
                
            // Render all sections of the template
            if (Array.isArray(template.sections) && template.sections.length > 0) {
                template.sections.forEach((section, idx) => {
                    const sectionEl = templateEl.createEl('div', { cls: 'voice-journal-template-section' });
                    // Add visual separation between sections
                    sectionEl.style.borderBottom = '1px solid var(--background-modifier-border)';
                    sectionEl.style.marginBottom = '1.5em';
                    sectionEl.style.paddingBottom = '1em';
                    
                    // Make section title editable with bold styling
                    new Setting(sectionEl)
                        .setName('Section Title')
                        .setClass('section-title-setting')
                        .then(setting => {
                            // Style the setting name to look like h4 but bold
                            const nameEl = setting.nameEl;
                            nameEl.style.fontWeight = 'bold';
                            nameEl.style.marginBottom = '0.4em';
                        })
                        .addText(text => {
                            text.setValue(section.title || `Section ${idx + 1}`)
                                .onChange(async (value) => {
                                    // Just update the model and save, don't re-render yet
                                    template.sections[idx].title = value;
                                    await this.plugin.saveSettings();
                                });
                                
                            // Add blur event to update the dropdown when user leaves the field
                            text.inputEl.addEventListener('blur', async () => {
                                // Full re-render is the most reliable way to update the dropdown
                                // But only do this when the user leaves the field to avoid focus loss
                                this.renderTemplatesTab(containerEl);
                            });
                            // Make the input field wider
                            text.inputEl.style.width = '100%';
                        });

                    // Content editor
                    new Setting(sectionEl)
                        .setName('Content')
                        .addTextArea(textarea => {
                            textarea.setValue(section.content || '');
                            textarea.inputEl.rows = 4;
                            textarea.inputEl.style.width = '100%';
                            textarea.inputEl.style.resize = 'none';
                            textarea.onChange(async (value) => {
                                template.sections[idx].content = value;
                                await this.plugin.saveSettings();
                            });
                        });

                    // Prompt editor
                    new Setting(sectionEl)
                        .setName('Prompt')
                        .addTextArea(textarea => {
                            textarea.setValue(section.prompt || '');
                            textarea.inputEl.rows = 4;
                            textarea.inputEl.style.width = '100%';
                            textarea.inputEl.style.resize = 'none';
                            textarea.onChange(async (value) => {
                                template.sections[idx].prompt = value;
                                await this.plugin.saveSettings();
                            });
                        });

                    // Optional section toggle
                    new Setting(sectionEl)
                        .setName('Optional Section')
                        .setDesc('If checked, this section will be treated as optional when using the template.')
                        .addToggle(toggle => {
                            toggle.setValue(section.optional ?? false);
                            toggle.onChange(async (value: boolean) => {
                                template.sections[idx].optional = value;
                                await this.plugin.saveSettings();
                            });
                        });
                });
                
                // Add section removal UI at the bottom
                if (template.sections.length > 1) {
                    const removalContainer = templateEl.createEl('div', { cls: 'section-removal-container' });
                    
                    const removalSetting = new Setting(removalContainer)
                        .setName('Remove Section')
                        .setDesc('Select and remove a section from this template');
                    
                    // Add dropdown to select which section to remove
                    let selectedSectionIndex = 0;
                    removalSetting.addDropdown(dropdown => {
                        // Add each section title to the dropdown
                        template.sections.forEach((section, idx) => {
                            dropdown.addOption(idx.toString(), section.title || `Section ${idx + 1}`);
                        });
                        
                        dropdown.setValue(selectedSectionIndex.toString());
                        dropdown.onChange(value => {
                            selectedSectionIndex = parseInt(value);
                        });
                    });
                    
                    // Add button to remove the selected section
                    removalSetting.addButton(button => {
                        button.setButtonText('Remove')
                            .setWarning()
                            .onClick(async () => {
                                // Remove the selected section
                                if (selectedSectionIndex >= 0 && selectedSectionIndex < template.sections.length) {
                                    template.sections.splice(selectedSectionIndex, 1);
                                    await this.plugin.saveSettings();
                                    this.renderTemplatesTab(containerEl);
                                }
                            });
                    });
                }
            } else {
                // No sections: show message and button to add the first section
                templateEl.createEl('p', { text: 'This template has no sections. Add one below.' });
                new Setting(templateEl)
                    .addButton(button => {
                        button.setButtonText('Add Section')
                            .setCta()
                            .onClick(async () => {
                                template.sections = [
                                    { title: 'New Section', content: '', prompt: '', optional: false }
                                ];
                                await this.plugin.saveSettings();
                                this.renderTemplatesTab(containerEl);
                            });
                    });
            }
        }
        
        // Add remove template button at the bottom (outside the box)
        if (this.selectedTemplateId) {
            const template = templates.find((t: JournalTemplate) => t.id === this.selectedTemplateId);
            if (template) {
                new Setting(containerEl)
                    .setName('Remove Template')
                    .setDesc('Delete this template')
                    .addButton(button => {
                        button.setButtonText('Remove')
                            .setWarning()
                            .onClick(async () => {
                                // Remove the template from settings
                                const templateIndex = this.plugin.settings.templates.findIndex(t => t.id === template.id);
                                if (templateIndex > -1) {
                                    this.plugin.settings.templates.splice(templateIndex, 1);
                                    await this.plugin.saveSettings();
                                    
                                    // Reset selected template ID
                                    this.selectedTemplateId = this.plugin.settings.templates.length > 0 
                                        ? this.plugin.settings.templates[0].id 
                                        : null;
                                        
                                    // Refresh the view
                                    this.renderTemplatesTab(containerEl);
                                }
                            });
                    });
            }
        }
    }

    // End renderTemplatesTab
    return;
}

/**
 * Add CSS styles for the tabbed interface
 */
private addStyles(): void {
    // Remove previous styles
    const prevStyle = document.getElementById('voice-journal-settings-styles');
    if (prevStyle !== null) {
        prevStyle.remove();
    }

    // Create style element
    const styleEl = document.createElement('style');
    styleEl.id = 'voice-journal-settings-styles';
    // Add styles for tabs
    styleEl.textContent = `
        .voice-journal-tab-header {
            display: flex;
            border-bottom: 1px solid var(--background-modifier-border);
            margin-bottom: 20px;
        }
        .voice-journal-tab-header button {
            background: none;
            border: none;
            padding: 8px 16px;
            font-size: 14px;
            cursor: pointer;
            position: relative;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
        }
        .voice-journal-tab-header button:hover {
            color: var(--text-accent);
        }
        .voice-journal-tab-header button.voice-journal-tab-active {
            color: var(--text-accent);
            border-bottom: 2px solid var(--text-accent);
        }
        .voice-journal-template-editor {
            margin-top: 20px;
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 5px;
        }
        .voice-journal-new-template {
            margin-top: 30px;
        }
        
        .voice-journal-template-section {
            background-color: var(--background-secondary);
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 20px;
        }
    `;
    // Add to document
    document.head.appendChild(styleEl);
}

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

// End of VoiceAIJournalSettingsTab class
}
