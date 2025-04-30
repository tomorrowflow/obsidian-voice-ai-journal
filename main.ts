import { Notice, Plugin, TFile, Platform } from 'obsidian';
import { initAI, waitForAI } from '@obsidian-ai-providers/sdk';

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
import './src/styles.css';
import './src/ui/styles/recording-modal.css';

/**
 * Interface for recording processing options
 */
export interface RecordingProcessOptions {
	appendToActiveNote: boolean;
	onlyTranscribe: boolean;
	saveAudioFile: boolean;
	automaticSpeechDetection: boolean;
	diaryEntryDate: string;
	selectedTemplate: string;
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
			const fileExt = this.recordingManager.getRecordingFileExtension().substring(1); // Remove the dot
			
			// Get recordings location from settings
			const recordingsFolder = this.settings.recordingsLocation || 'Recordings';
			
			// Create folder if it doesn't exist
			await this.fileService.ensureFolderExists(recordingsFolder);
			
			// Generate a filename with timestamp to avoid duplicates
			const timestamp = new Date().toISOString().replace(/[:T-]/g, '').slice(0, 14);
			const fileName = `recording-${timestamp}.${fileExt}`;
			const filePath = `${recordingsFolder}/${fileName}`;
			
			// Convert Blob to ArrayBuffer for saving to vault
			const buffer = await audioBlob.arrayBuffer();
			const array = new Uint8Array(buffer);
			
			// Save audio file if option is enabled
			let audioFile: TFile | null = null;
			if (options.saveAudioFile) {
				// Save to vault
				await this.app.vault.createBinary(filePath, array);
				new Notice(`Audio file saved to ${filePath}`);
				
				// Get file reference for transcription
				const savedFile = this.app.vault.getAbstractFileByPath(filePath);
				if (!savedFile || !(savedFile instanceof TFile)) {
					throw new Error('Could not find the saved audio file');
				}
				audioFile = savedFile;
			}
			
			// Transcribe the audio
			new Notice('Transcribing audio...');
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
					content += `[Original Audio](${filePath})\n`;
				}
				
				// Create the note
				const noteFile = await this.app.vault.create(notePath, content);
				
				// Open the note
				await this.app.workspace.getLeaf().openFile(noteFile);
			} else {
				// Process with AI using the template
				// TODO: Implement AI processing with template
				// For now, just create a note with the transcription
				const date = options.diaryEntryDate ? new Date(options.diaryEntryDate) : new Date();
				const formattedDate = date.toISOString().split('T')[0];
				const noteName = `${formattedDate} Journal Entry.md`;
				const notePath = `${this.settings.noteLocation}/${noteName}`;
				
				// Create the content
				let content = `# Journal Entry - ${formattedDate}\n\n`;
				content += `## Transcription\n\n${transcriptionResult.text}\n\n`;
				
				// Add link to the audio file if it was saved
				if (audioFile) {
					content += `[Original Audio](${filePath})\n`;
				}
				
				// Create the note
				const noteFile = await this.app.vault.create(notePath, content);
				
				// Open the note
				await this.app.workspace.getLeaf().openFile(noteFile);
			}
			
			new Notice('Voice AI Journal: Processing complete!');
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
		
		// 2. Upload audio file icon (desktop only)
		if (!Platform.isMobile) {
			this.addRibbonIcon('upload', 'Upload audio file', async (evt: MouseEvent) => {
				if (!this.aiProviders && this.settings.transcriptionProvider !== 'localWhisper') {
					new Notice('AI providers are not initialized. Please try again in a moment.');
					return;
				}
				
				// Create a file input element
				const fileInput = document.createElement('input');
				fileInput.type = 'file';
				fileInput.accept = 'audio/*';
				fileInput.style.display = 'none';
				document.body.appendChild(fileInput);
				
				// Handle file selection
				fileInput.addEventListener('change', async () => {
					if (fileInput.files && fileInput.files.length > 0) {
						const file = fileInput.files[0];
						await this.processAudioFile(file);
					}
					// Remove the input element
					document.body.removeChild(fileInput);
				});
				
				// Trigger file selection dialog
				fileInput.click();
			});
		} // End of desktop-only condition

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
	private async processAudioFile(file: File): Promise<void> {
		try {
			new Notice(`Processing audio file: ${file.name}`);
			
			// Get recordings location from settings
			const recordingsFolder = this.settings.recordingsLocation || '/Recordings';
			
			// Create folder if it doesn't exist
			await this.fileService.ensureFolderExists(recordingsFolder);
			
			// Generate a filename with timestamp to avoid duplicates
			const timestamp = new Date().toISOString().replace(/[:T-]/g, '').slice(0, 14);
			// Extract file extension from file name
			const fileExt = file.name.split('.').pop() || 'mp3';
			const fileName = `recording-${timestamp}.${fileExt}`;
			const filePath = `${recordingsFolder}/${fileName}`;
			
			// Convert File to ArrayBuffer
			const buffer = await file.arrayBuffer();
			const array = new Uint8Array(buffer);
			
			// Save to vault
			await this.app.vault.createBinary(filePath, array);
			
			new Notice(`Audio file saved to ${filePath}`);
			
			// Get audio file reference
			const audioFile = this.app.vault.getAbstractFileByPath(filePath);
			if (!audioFile || !(audioFile instanceof TFile)) {
				throw new Error('Could not find the saved audio file');
			}
			
			new Notice('Transcribing audio file...');
			
			// Use our ASRManager to transcribe the audio file
			const transcriptionResult = await this.asrManager.transcribeAudioFileFromVault(audioFile);
			
			if (!transcriptionResult || !transcriptionResult.text) {
				throw new Error('Transcription failed or returned empty result');
			}
			
			// We'll use the default template for now
			// In the future, we could implement a template selection dialog
			const selectedTemplateId = this.settings.defaultTemplate;
			
			new Notice('Analyzing journal entry...');
			
			// Import the shared audio processing utility
			const { processTranscriptionWithTemplate, createJournalEntry } = await import('./src/utils/audioProcessingUtils');
			
			// Generate filename using the template manager
			const filename = this.templateManager.generateFilename(this.settings.noteNamingFormat);
			
			// Process transcription with the selected template
			const processedContent = await processTranscriptionWithTemplate(
				this,
				transcriptionResult.text,
				selectedTemplateId,
				filePath,
				transcriptionResult.detectedLanguage // Pass the full detected language
			);
			
			// Create the journal entry
			await createJournalEntry(this, processedContent, filename);
			
			new Notice('Journal entry processing complete!');
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
