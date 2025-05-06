import { Notice, Plugin, TFile } from 'obsidian';
import { initAI, waitForAI } from '@obsidian-ai-providers/sdk';
import { startTimer } from './src/utils/timerUtils';

// Import settings and types
import { VoiceAIJournalSettings, DEFAULT_SETTINGS, VoiceAIJournalSettingsTab } from './src/settings';
import { JournalTemplate, AIProviders } from './src/types';

// Import internal modules
import { AIManager } from './src/ai/AIManager';
import { ASRManager } from './src/ai/ASRManager';
import { RecordingManager, RecordingState } from './src/recording/RecordingManager';
import { RecordingModal } from './src/ui/modals/RecordingModal';
import { TemplateManager } from './src/templates/TemplateManager';
import { FileService } from './src/services/FileService';
import { storeTranscriptAsMarkdown } from './src/utils/storeTranscriptAsMarkdown';
import { generateNoteTitle } from './src/utils/titleGenerator';
import './src/styles.css';
import './src/ui/styles/recording-modal.css';

/**
 * Interface for recording processing options
 */
export interface RecordingProcessOptions {
	appendToActiveNote: boolean;
	onlyTranscribe: boolean;
	saveAudioFile: boolean;
	diaryEntryDate: string;
	selectedTemplate: string;
	modalInstance?: RecordingModal; // Reference to the modal instance for updating UI
}

/**
 * Main plugin class
 */
export default class VoiceAIJournalPlugin extends Plugin {
	settings: VoiceAIJournalSettings;
	aiProviders: AIProviders | null = null;
	aiManager: AIManager;
	asrManager: ASRManager;
	recordingManager: RecordingManager;
	templateManager: TemplateManager;
	private fileService: FileService;
	
	/**
	 * Start recording audio
	 * @returns Promise that resolves to true if recording started successfully
	 */
	async startRecording(): Promise<boolean> {
		return this.recordingManager.startRecording();
	}
	
	/**
	 * Toggle between pause and resume recording
	 * @returns Promise that resolves to true if operation was successful
	 */
	async togglePauseResume(): Promise<boolean> {
		return this.recordingManager.togglePauseResume();
	}
	
	/**
	 * Get the current recording state
	 * @returns Current recording state
	 */
	getRecordingState(): RecordingState {
		return this.recordingManager.getRecordingState();
	}
	
	/**
	 * Get the current recording time in milliseconds
	 * @returns Current recording time in milliseconds
	 */
	getRecordingTime(): number {
		return this.recordingManager.getRecordingTime();
	}
	
	/**
	 * Cancel the current recording
	 */
	async cancelRecording(): Promise<void> {
		return this.recordingManager.cancelRecording();
	}
	
	/**
	 * Stop recording and process the audio
	 * @param options Options for processing the recording
	 */
	async stopAndProcess(options: RecordingProcessOptions): Promise<void> {
		try {
			// Show processing notice
			new Notice('Voice AI Journal: Processing recording...');
			
			// Stop the recording and get the audio blob
			const audioBlob = await this.recordingManager.stopRecording();
			
			// Get the file extension for the audio
			const rawExtension = this.recordingManager.getRecordingFileExtension();
			const fileExt = rawExtension.substring(1); // Remove the dot
			console.log(`[Voice AI Journal] Using file extension: ${rawExtension} -> ${fileExt}`);
			
			// Convert Blob to ArrayBuffer for saving to vault
			const buffer = await audioBlob.arrayBuffer();
			
			// Save audio file if option is enabled
			let audioFile: TFile | null = null;
			if (options.saveAudioFile) {
				// Import the file storage utility
				const { storeFileWithStructure } = await import('./src/utils/fileStoreUtils');
				const audioDate = new Date();
				
				// Force m4a extension for iOS devices
				const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
						(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
				
				// Use m4a for iOS, otherwise use the detected extension
				const finalExtension = isIOS ? '.m4a' : `.${fileExt}`;
				console.log(`[Voice AI Journal] Final file extension for saving: ${finalExtension} (iOS detected: ${isIOS})`);
				
				// Store the audio file with the structured path
				audioFile = await storeFileWithStructure({
					plugin: this,
					type: 'audio',
					baseFileName: '', // Empty as filename is generated in buildStructuredPath
					content: buffer,
					date: audioDate,
					extension: finalExtension
				});
				
				if (audioFile) {
					new Notice(`Audio file saved to ${audioFile.path}`);
				} else {
					throw new Error('Could not save the audio file');
				}
			}
			
			// Transcribe the audio
			new Notice('Transcribing audio...');
			// Update modal status if available
			if (options.modalInstance) {
				options.modalInstance.updateProcessingStatus('Transcribing audio...', 1);
			}
			let transcriptionResult;
			
			if (audioFile) {
				// Transcribe from saved file
				transcriptionResult = await this.asrManager.transcribeAudioFileFromVault(audioFile);
			} else {
				// Transcribe directly from blob
				transcriptionResult = await this.asrManager.transcribeAudio(audioBlob, 'auto', fileExt);
			}
			
			if (!transcriptionResult || !transcriptionResult.text) {
				throw new Error('Transcription failed or returned empty result');
			}
			
			// Only transcribe if that's all the user wants
			if (options.onlyTranscribe) {
				// Create a note with just the transcription
				const date = options.diaryEntryDate ? new Date(options.diaryEntryDate) : new Date();
				const formattedDate = date.toISOString().split('T')[0];
				const noteName = `${formattedDate} Transcription.md`;
				const notePath = `${this.settings.noteLocation}/${noteName}`;
				
				// Create the content
				let content = `# Audio Transcription - ${formattedDate}\n\n`;
				
				// Add detected language info if available
				if (transcriptionResult.detectedLanguage) {
					content += `*Detected language: ${transcriptionResult.detectedLanguage}*\n\n`;
				}
				
				// Add the transcription text
				content += `## Transcription\n\n${transcriptionResult.text}\n\n`;
				
				// Add link to the audio file if it was saved
				if (audioFile) {
					content += `[Original Audio](${audioFile.path})\n`;
				}
				
				// Create the note
				const noteFile = await this.app.vault.create(notePath, content);

				// Store the raw transcript as a markdown note (new feature)
				try {
					const transcriptBaseName = noteFile.basename || noteFile.name.replace(/\.md$/, '');
					await storeTranscriptAsMarkdown(this, transcriptionResult.text, transcriptBaseName);
					// We don't need to track the transcript path in this case
				} catch (err) {
					console.error('Failed to save transcript as markdown:', err);
				}

				// Open the note
				await this.app.workspace.getLeaf().openFile(noteFile);
			} else {
				// Process with AI using the template
				// TODO: Implement AI processing with template
				// For now, just create a note with the transcription
				const date = options.diaryEntryDate ? new Date(options.diaryEntryDate) : new Date();
				// We'll use the template manager to generate the filename instead
				
				// Import the audio processing utilities
				const { processTranscriptionWithTemplate, createJournalEntry } = await import('./src/utils/audioProcessingUtils');
				
				// Store the raw transcript immediately after receiving it
				let transcriptPath = '';
				try {
					const transcriptResult = await storeTranscriptAsMarkdown(this, transcriptionResult.text, '', date);
					transcriptPath = transcriptResult.path;
					new Notice('Transcript saved successfully');
					// Update modal status if available
					if (options.modalInstance) {
						options.modalInstance.updateProcessingStatus('Transcript saved successfully', 3);
					}
				} catch (err) {
					console.error('Failed to save transcript as markdown:', err);
				}
				
				// Get the selected template ID
				const selectedTemplateId = options.selectedTemplate || this.settings.defaultTemplate;
				
				// Process transcription with the selected template
				const processedContent = await processTranscriptionWithTemplate(
					this,
					transcriptionResult.text,
					selectedTemplateId,
					audioFile ? audioFile.path : undefined,
					transcriptPath,
					transcriptionResult.detectedLanguage,
					transcriptionResult.languageCode,
					'', // No generated title yet
					options.modalInstance // Pass the modal instance for UI updates
				);
				
				// Generate a title for the note in the detected language
				// Update modal status if available
				if (options.modalInstance) {
					// Calculate the total number of steps (transcription + tags + template sections)
					const template = this.getTemplateById(selectedTemplateId);
					const sectionCount = template?.sections?.length || 0;
					const totalSteps = 3 + sectionCount; // ASR (1) + Tags (2) + Template sections + Title (last step)
					
					// Title generation is the last step
					options.modalInstance.updateProcessingStatus('Generating title...', totalSteps);
				}
				
				// Show notification for title generation
				new Notice('Generating title for journal entry...');
				
				// Start timer for title generation
				const titleTimer = startTimer('Title Generation');
				
				// Generate the title
				const noteTitle = await generateNoteTitle(
					this, 
					transcriptionResult.text,
					transcriptionResult.detectedLanguage, // Pass the detected language
					transcriptionResult.languageCode // Pass the language code
				);
				
				// Show completion notification with timer
				new Notice(`Title generated in ${titleTimer.getFormattedTime()}: "${noteTitle || 'No title generated'}"`);
				
				// Generate filename using the template manager with the specified date
				const filename = this.templateManager.generateFilename(this.settings.noteNamingFormat, date);
				
				// Create the journal entry with the title
				await createJournalEntry(this, processedContent, filename, noteTitle);
				
				// Note will be opened by createJournalEntry
			}
			
			new Notice('Voice AI Journal: Processing complete!');
			// Update modal status if available
			if (options.modalInstance) {
				// Calculate the total number of steps + 1 for completion
				const template = this.getTemplateById(options.selectedTemplate || this.settings.defaultTemplate);
				const sectionCount = template?.sections?.length || 0;
				const totalSteps = 3 + sectionCount; // ASR + Tags + Template sections + Title
				
				// Final step is completion (one step after title generation)
				options.modalInstance.updateProcessingStatus('Processing complete!', totalSteps + 1);
			}
		} catch (error) {
			console.error('Failed to process recording:', error);
			new Notice(`Failed to process recording: ${error instanceof Error ? error.message : String(error)}`);
			throw error; // Re-throw to allow caller to handle
		}
	}

	/**
	 * Initialize the plugin
	 */
	async onload() {
		await this.loadSettings();

		// Initialize AI Providers with proper configuration
		initAI(this.app, this, async () => {
			try {
				const aiResolver = await waitForAI();
				this.aiProviders = await aiResolver.promise;
				console.log('AI Providers loaded', this.aiProviders?.providers?.length || 'No providers found');
			} catch (error) {
				console.error('Failed to initialize AI Providers', error);
				new Notice('Voice AI Journal: Failed to initialize AI Providers plugin. Please make sure it is installed and enabled.');
			}

			// Initialize managers after AI is loaded
			this.aiManager = new AIManager(this.aiProviders, this);
			this.asrManager = new ASRManager(this);
			this.recordingManager = new RecordingManager(this);
			this.templateManager = new TemplateManager();
			this.fileService = new FileService(this.app);
			
			// Register settings tab
			this.addSettingTab(new VoiceAIJournalSettingsTab(this.app, this));
			
			// Register plugin components and commands
			await this.registerPluginComponents();
		});
	}

	/**
	 * Clean up when plugin is disabled
	 */
	onunload(): void {
		// Nothing to unload yet
	}

	/**
	 * Load settings from disk
	 */
	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save settings to disk
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
	
	/**
	 * Get a template by ID
	 * @param id The template ID
	 * @returns The template or undefined if not found
	 */
	getTemplateById(id: string): JournalTemplate | undefined {
		return this.settings.templates?.find(t => t.id === id);
	}
	
	/**
	 * Add a new template
	 * @param template The template to add
	 */
	addTemplate(template: JournalTemplate): void {
		if (!this.settings.templates) {
			this.settings.templates = [];
		}
		this.settings.templates.push(template);
		this.saveSettings();
	}
	
	/**
	 * Update an existing template
	 * @param id The template ID to update
	 * @param template The updated template
	 */
	updateTemplate(id: string, template: JournalTemplate): void {
		if (!this.settings.templates) return;
		
		const index = this.settings.templates.findIndex(t => t.id === id);
		if (index >= 0) {
			this.settings.templates[index] = template;
			this.saveSettings();
		}
	}
	
	/**
	 * Delete a template
	 * @param id The template ID to delete
	 */
	deleteTemplate(id: string): void {
		if (!this.settings.templates) return;
		
		this.settings.templates = this.settings.templates.filter(t => t.id !== id);
		this.saveSettings();
	}

	/**
	 * This method loads all UI components and registers commands
	 */
	async registerPluginComponents(): Promise<void> {
		// Import the template manager modal
		const { TemplateManagerModal } = await import('./src/ui/TemplateEditorModal');

		// 1. Add ribbon icon for starting recording
		this.addRibbonIcon('microphone', 'Start Voice Recording', async (evt: MouseEvent) => {
			// Check if we can access the microphone
			if (!await this.recordingManager.checkMicrophoneAccess()) {
				new Notice('Microphone access is required to use Voice AI Journal');
				return;
			}
			new RecordingModal(this).open();
		});
		
		// Upload audio file functionality moved to recording modal

		// Register commands
		this.addCommand({
			id: 'start-voice-recording',
			name: 'Start Voice Recording',
			callback: async () => {
				// Check if we can access the microphone
				if (!await this.recordingManager.checkMicrophoneAccess()) {
					new Notice('Microphone access is required to use Voice AI Journal');
					return;
				}
				new RecordingModal(this).open();
			}
		});
		
		// Template editor command
		this.addCommand({
			id: 'open-template-editor',
			name: 'Open Template Editor',
			callback: () => {
				new TemplateManagerModal(this.app, this).open();
			}
		});
		
		// Add more commands as needed
	}

	/**
	 * Process an uploaded audio file
	 * @param file The audio file from the file upload dialog
	 */
	async processAudioFile(file: File, modalInstance?: any): Promise<void> {
		try {
			new Notice(`Processing audio file: ${file.name}`);
			// Update modal status if available
			if (modalInstance) {
				modalInstance.updateProcessingStatus(`Processing audio file: ${file.name}`, 1);
			}
			
			// Convert File to ArrayBuffer for saving
			const buffer = await file.arrayBuffer();
			
			// Extract file extension from file name
			const fileExt = file.name.split('.').pop() || 'mp3';
			
			// Save the audio file using our unified file structure
			const { storeFileWithStructure } = await import('./src/utils/fileStoreUtils');
			const audioDate = new Date();
			
			// Force m4a extension for iOS devices
			const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
					(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
			
				// Use m4a for iOS, otherwise use the detected extension
			const finalExtension = isIOS ? '.m4a' : `.${fileExt}`;
			console.log(`[Voice AI Journal] Final file extension for saving: ${finalExtension} (iOS detected: ${isIOS})`);
			
				// Store the audio file with the structured path
			const audioFile = await storeFileWithStructure({
				plugin: this,
				type: 'audio',
				baseFileName: '', // Empty as filename is generated in buildStructuredPath
				content: buffer,
				date: audioDate,
				extension: finalExtension
			});
			
			new Notice(`Audio file saved successfully`);
			if (!audioFile || !(audioFile instanceof TFile)) {
				throw new Error('Could not find the saved audio file');
			}
			
			new Notice('Transcribing audio file...');
			// Update modal status if available
			if (modalInstance) {
				modalInstance.updateProcessingStatus('Transcribing audio file...', 2);
			}
			
			// Use our ASRManager to transcribe the audio file
			const transcriptionResult = await this.asrManager.transcribeAudioFileFromVault(audioFile);
			
			if (!transcriptionResult || !transcriptionResult.text) {
				throw new Error('Transcription failed or returned empty result');
			}
			
			// Store the raw transcript immediately after receiving it
			let transcriptPath = '';
			try {
				const transcriptResult = await storeTranscriptAsMarkdown(this, transcriptionResult.text, '', audioDate);
				transcriptPath = transcriptResult.path;
				new Notice('Transcript saved successfully');
			} catch (err) {
				console.error('Failed to save transcript as markdown:', err);
			}
			
			// We'll use the default template for now
			// In the future, we could implement a template selection dialog
			const selectedTemplateId = this.settings.defaultTemplate;
			
			new Notice('Analyzing journal entry...');
			// Update modal status if available
			if (modalInstance) {
				modalInstance.updateProcessingStatus('Analyzing journal entry...', 3);
			}
			
			// Import the shared audio processing utility
			const { processTranscriptionWithTemplate, createJournalEntry } = await import('./src/utils/audioProcessingUtils');
			
			// Generate filename using the template manager
			const filename = this.templateManager.generateFilename(this.settings.noteNamingFormat);
			
			// Process transcription with the selected template
			const processedContent = await processTranscriptionWithTemplate(
				this,
				transcriptionResult.text,
				selectedTemplateId,
				audioFile ? audioFile.path : undefined,
				transcriptPath, // Pass the transcript file path
				transcriptionResult.detectedLanguage, // Pass the full detected language name
				transcriptionResult.languageCode // Pass the language code
			);
			
			// Update modal status if available
			if (modalInstance) {
				// Calculate the total number of steps (transcription + template sections)
				const template = this.getTemplateById(selectedTemplateId);
				const sectionCount = template?.sections?.length || 0;
				const totalSteps = 2 + sectionCount; // Transcription (1) + Template sections + Title (last step)
				
				// Title generation is the last step
				modalInstance.updateProcessingStatus('Generating title...', totalSteps);
			}
			
			// Show notification for title generation
			new Notice('Generating title for journal entry...');
			
			// Start timer for title generation
			const titleTimer = startTimer('Title Generation');
			
			// Generate the title
			const noteTitle = await generateNoteTitle(
				this, 
				transcriptionResult.text,
				transcriptionResult.detectedLanguage, // Pass the detected language
				transcriptionResult.languageCode // Pass the language code
			);
			
			// Show completion notification with timer
			new Notice(`Title generated in ${titleTimer.getFormattedTime()}: "${noteTitle || 'No title generated'}"`);
			
			// Create the journal entry with the title
			await createJournalEntry(this, processedContent, filename, noteTitle);
			
			new Notice('Journal entry processing complete!');
			// Update modal status if available
			if (modalInstance) {
				// Calculate the total number of steps + 1 for completion
				const template = this.getTemplateById(selectedTemplateId);
				const sectionCount = template?.sections?.length || 0;
				const totalSteps = 2 + sectionCount; // Transcription + Template sections + Title
				
				// Final step is completion (one step after title generation)
				modalInstance.updateProcessingStatus('Processing complete!', totalSteps + 1);
				
				// Delay closing the modal so users can read the final step
				modalInstance.closeWithDelay();
			}
		} catch (error) {
			console.error('Failed to process audio file:', error);
			new Notice(`Failed to process audio file: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	
	/**
	 * Ensures a folder exists in the vault, creating it if necessary
	 * @param path The folder path to ensure
	 */
	private async ensureFolderExists(path: string): Promise<void> {
		return this.fileService.ensureFolderExists(path);
	}
}
