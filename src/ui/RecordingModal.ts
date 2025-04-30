import { App, Modal, Notice, TFile } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';
import { AudioRecorder, type RecordingStatus } from '../audio/AudioRecorder';
import { AIManager } from '../ai/AIManager';
import { TemplateManager } from '../templates/TemplateManager';

/**
 * Modal for recording voice notes and processing them into journal entries
 */
export class RecordingModal extends Modal {
    private plugin: VoiceAIJournalPlugin;
    private audioRecorder: AudioRecorder;
    private aiManager: AIManager;
    private templateManager: TemplateManager;
    
    // UI elements
    private recordingContainer: HTMLElement;
    private statusIndicator: HTMLElement;
    private timerEl: HTMLElement;
    private controlsContainer: HTMLElement;
    private waveformEl: HTMLElement;
    private templateSelectEl: HTMLSelectElement;
    
    // State
    private recordingStatus: RecordingStatus = 'stopped';
    private transcriptionInProgress = false;
    private selectedTemplateId: string;

    constructor(app: App, plugin: VoiceAIJournalPlugin) {
        super(app);
        this.plugin = plugin;
        
        // Initialize components
        this.audioRecorder = new AudioRecorder(this.plugin.settings.audioQuality);
        this.aiManager = new AIManager(this.plugin.aiProviders, this.plugin);
        this.templateManager = new TemplateManager();
        
        // Set initial template
        this.selectedTemplateId = this.plugin.settings.defaultTemplate;
        
        // Set up recorder event handlers
        this.audioRecorder.onStatusChange(this.handleStatusChange.bind(this));
        this.audioRecorder.onTimeUpdate(this.updateTimer.bind(this));
        this.audioRecorder.onError(this.handleRecordingError.bind(this));
    }

    onOpen() {
        const { contentEl } = this;
        
        // Set modal title
        contentEl.createEl('h2', { text: 'Voice AI Journal' });
        
        // Create main container for recording UI
        this.recordingContainer = contentEl.createDiv('voice-ai-journal-recording-container');
        
        // Create template selection
        const templateSelectionContainer = this.recordingContainer.createDiv('voice-ai-journal-template-selection');
        templateSelectionContainer.createEl('label', { text: 'Template: ' });
        
        this.templateSelectEl = document.createElement('select');
        this.templateSelectEl.addClass('dropdown');
        
        // Populate template options
        this.plugin.settings.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.text = template.name;
            this.templateSelectEl.appendChild(option);
        });
        
        this.templateSelectEl.value = this.selectedTemplateId;
        this.templateSelectEl.addEventListener('change', () => {
            this.selectedTemplateId = this.templateSelectEl.value;
        });
        
        templateSelectionContainer.appendChild(this.templateSelectEl);
        
        // Create recording status indicator
        const statusContainer = this.recordingContainer.createDiv('voice-ai-journal-recording-status');
        this.statusIndicator = statusContainer.createDiv('voice-ai-journal-recording-indicator stopped');
        
        const statusTextEl = statusContainer.createSpan('voice-ai-journal-status-text');
        statusTextEl.setText('Ready');
        
        this.timerEl = statusContainer.createSpan('voice-ai-journal-timer');
        this.timerEl.setText('00:00');
        
        // Create waveform visualization (placeholder for now)
        this.waveformEl = this.recordingContainer.createDiv('voice-ai-journal-waveform');
        
        // Create controls
        this.controlsContainer = this.recordingContainer.createDiv('voice-ai-journal-controls');
        this.createControls();
        
        // Info text
        const infoEl = this.recordingContainer.createDiv('voice-ai-journal-info');
        infoEl.createEl('p', { 
            text: 'Record your voice note, then process it to create a journal entry with AI-powered transcription and analysis.' 
        });
    }

    onClose() {
        // Ensure recording is stopped if modal is closed
        if (this.recordingStatus !== 'stopped') {
            this.audioRecorder.cancelRecording();
        }
        
        // Clear the modal content
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Create the recording control buttons
     */
    private createControls() {
        this.controlsContainer.empty();
        
        if (this.recordingStatus === 'stopped') {
            // Record button
            const recordButton = this.createControlButton('Start Recording', 'play', true);
            recordButton.addEventListener('click', this.startRecording.bind(this));
            this.controlsContainer.appendChild(recordButton);
            
            // Cancel button
            const cancelButton = this.createControlButton('Cancel', 'cross');
            cancelButton.addEventListener('click', () => this.close());
            this.controlsContainer.appendChild(cancelButton);
        } 
        else if (this.recordingStatus === 'recording') {
            // Pause button
            const pauseButton = this.createControlButton('Pause', 'pause');
            pauseButton.addEventListener('click', this.pauseRecording.bind(this));
            this.controlsContainer.appendChild(pauseButton);
            
            // Stop button
            const stopButton = this.createControlButton('Stop & Process', 'checkmark', true);
            stopButton.addEventListener('click', this.stopAndProcess.bind(this));
            this.controlsContainer.appendChild(stopButton);
            
            // Cancel button
            const cancelButton = this.createControlButton('Cancel', 'cross');
            cancelButton.addEventListener('click', this.cancelRecording.bind(this));
            this.controlsContainer.appendChild(cancelButton);
        } 
        else if (this.recordingStatus === 'paused') {
            // Resume button
            const resumeButton = this.createControlButton('Resume', 'play', true);
            resumeButton.addEventListener('click', this.resumeRecording.bind(this));
            this.controlsContainer.appendChild(resumeButton);
            
            // Stop button
            const stopButton = this.createControlButton('Stop & Process', 'checkmark');
            stopButton.addEventListener('click', this.stopAndProcess.bind(this));
            this.controlsContainer.appendChild(stopButton);
            
            // Cancel button
            const cancelButton = this.createControlButton('Cancel', 'cross');
            cancelButton.addEventListener('click', this.cancelRecording.bind(this));
            this.controlsContainer.appendChild(cancelButton);
        }
    }

    /**
     * Create a control button with the given label and icon
     */
    private createControlButton(label: string, icon?: string, primary = false): HTMLElement {
        const button = document.createElement('button');
        button.addClass('voice-ai-journal-control-button');
        
        if (primary) {
            button.addClass('primary');
        }
        
        if (icon) {
            const iconEl = document.createElement('span');
            // Fix: Add each class separately to avoid space-related errors
            iconEl.addClass('voice-ai-journal-icon');
            iconEl.addClass(`${icon}-icon`);
            button.appendChild(iconEl);
        }
        
        const labelEl = document.createElement('span');
        labelEl.setText(label);
        button.appendChild(labelEl);
        
        return button;
    }

    /**
     * Handle recording status changes
     */
    private handleStatusChange(status: RecordingStatus) {
        this.recordingStatus = status;
        
        // Update UI based on new status
        this.statusIndicator.removeClass('recording paused stopped');
        this.statusIndicator.addClass(status);
        
        const statusTextMap = {
            'recording': 'Recording...',
            'paused': 'Paused',
            'stopped': 'Ready'
        };
        
        const statusTextEl = this.statusIndicator.nextElementSibling as HTMLElement;
        statusTextEl.setText(statusTextMap[status]);
        
        // Update controls
        this.createControls();
    }

    /**
     * Update the timer display
     */
    private updateTimer(timeMs: number) {
        const seconds = Math.floor(timeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const secondsDisplay = (seconds % 60).toString().padStart(2, '0');
        const minutesDisplay = minutes.toString().padStart(2, '0');
        
        this.timerEl.setText(`${minutesDisplay}:${secondsDisplay}`);
    }

    /**
     * Handle recording errors
     */
    private handleRecordingError(error: Error) {
        new Notice(`Recording error: ${error.message}`);
        console.error('Recording error:', error);
        
        // Reset recording state
        this.recordingStatus = 'stopped';
        this.createControls();
    }

    /**
     * Start the audio recording
     */
    private async startRecording() {
        await this.audioRecorder.startRecording();
    }

    /**
     * Pause the audio recording
     */
    private pauseRecording() {
        this.audioRecorder.pauseRecording();
    }

    /**
     * Resume a paused recording
     */
    private resumeRecording() {
        this.audioRecorder.resumeRecording();
    }

    /**
     * Cancel the recording
     */
    private cancelRecording() {
        this.audioRecorder.cancelRecording();
        this.close();
    }

    /**
     * Stop recording and process the audio
     */
    private async stopAndProcess() {
        if (this.transcriptionInProgress) {
            return;
        }
        
        try {
            // Update UI to show processing
            this.transcriptionInProgress = true;
            const statusTextEl = this.statusIndicator.nextElementSibling as HTMLElement;
            statusTextEl.setText('Processing...');
            
            // Stop recording and get audio blob
            const audioBlob = await this.audioRecorder.stopRecording();
            
            if (!audioBlob) {
                new Notice('No audio recorded');
                this.close();
                return;
            }
            
            // Disable template selection during processing
            this.templateSelectEl.disabled = true;
            
            // Process the recording
            await this.processRecording(audioBlob);
            
        } catch (error) {
            console.error('Processing error:', error);
            new Notice(`Error processing recording: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.transcriptionInProgress = false;
            this.close();
        }
    }

    /**
     * Process the recording: transcribe, analyze, and create journal entry
     */
    private async processRecording(audioBlob: Blob) {
        try {
            // Show progress
            new Notice('Transcribing audio...');
            
            // Transcribe audio
            const transcriptionProviderId = this.plugin.settings.aiProviders.transcription;
            const transcriptionResult = await this.aiManager.transcribeAudio(audioBlob, transcriptionProviderId);
            
            // Check if we have a valid transcription
            let transcription: string;
            let detectedLanguage: string | undefined;
            
            // Handle different possible return types from transcribeAudio
            if (typeof transcriptionResult === 'string') {
                // Simple string result
                transcription = transcriptionResult;
                // No detected language info
            } else if (transcriptionResult && typeof transcriptionResult === 'object') {
                // Object with text and possibly detectedLanguage
                // Type assertion to help TypeScript understand the structure
                const result = transcriptionResult as { text?: string; detectedLanguage?: string };
                transcription = result.text || '';
                detectedLanguage = result.detectedLanguage;
                
                if (detectedLanguage) {
                    console.log(`Detected language: ${detectedLanguage}`);
                    new Notice(`Detected language: ${detectedLanguage}`);
                }
            } else {
                throw new Error('Transcription failed or returned invalid result');
            }
            
            if (!transcription || transcription.trim() === '') {
                throw new Error('Transcription failed or returned empty result');
            }
            
            new Notice('Analyzing journal entry...');
            
            // Import the shared audio processing utility
            const { processTranscriptionWithTemplate, createJournalEntry } = await import('../utils/audioProcessingUtils');
            
            // Generate filename
            const filename = this.templateManager.generateFilename(this.plugin.settings.noteNamingFormat);
            
            // Process transcription with the selected template
            const processedContent = await processTranscriptionWithTemplate(
                this.plugin,
                transcription,
                this.selectedTemplateId,
                undefined, // No audio filename
                detectedLanguage // Pass the detected language if available
            );
            
            // Create the journal entry
            await createJournalEntry(this.plugin, processedContent, filename);
            
            // Save audio file if needed
            const audioFilename = `${filename}${this.audioRecorder.getFileExtension()}`;
            const audioFilePath = `${this.plugin.settings.recordingsLocation}/${audioFilename}`.replace(/\/+/g, '/');
            await this.saveAudioFile(audioBlob, audioFilePath);
            
            new Notice(`Journal entry created: ${filename}`);
        } catch (error) {
            console.error('Processing error:', error);
            throw error;
        }
    }

    /**
     * Create a new journal entry with the processed content
     */
    private async createJournalEntry(filename: string, content: string, audioBlob: Blob) {
        try {
            // Make sure the directory exists
            const filePath = `${this.plugin.settings.noteLocation}/${filename}.md`.replace(/\/+/g, '/');
            await this.ensureDirectoryExists(filePath);
            
            // Check if file exists and handle according to settings
            const fileExists = await this.app.vault.adapter.exists(filePath);
            
            if (fileExists && this.plugin.settings.appendToExistingNote) {
                // Append to existing file
                const existingContent = await this.app.vault.adapter.read(filePath);
                const newContent = `${existingContent}\n\n${content}`;
                await this.app.vault.adapter.write(filePath, newContent);
            } else {
                // Create new file
                await this.app.vault.create(filePath, content);
            }
            
            // Save audio recording if available
            if (audioBlob) {
                const audioFilename = `${filename}${this.audioRecorder.getFileExtension()}`;
                const audioFilePath = `${this.plugin.settings.noteLocation}/${audioFilename}`.replace(/\/+/g, '/');
                
                await this.saveAudioFile(audioBlob, audioFilePath);
            }
            
            // Open the file
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file && file instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(file);
            }
        } catch (error) {
            console.error('Error creating journal entry:', error);
            throw new Error(`Failed to create journal entry: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Save the audio file to the vault
     */
    private async saveAudioFile(audioBlob: Blob, filePath: string) {
        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Create the file
            await this.app.vault.createBinary(filePath, arrayBuffer);
        } catch (error) {
            console.error('Error saving audio file:', error);
            new Notice(`Failed to save audio recording: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Ensure that the directory for a file path exists
     */
    private async ensureDirectoryExists(filePath: string) {
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        
        if (dirPath && dirPath !== '/') {
            const exists = await this.app.vault.adapter.exists(dirPath);
            
            if (!exists) {
                await this.app.vault.createFolder(dirPath);
            }
        }
    }
}
