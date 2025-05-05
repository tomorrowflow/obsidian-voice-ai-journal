import { Modal, setIcon, Setting, Notice, Platform } from 'obsidian';
import type VoiceAIJournalPlugin from '../../../main';
import { formatRecordingTime } from '../utils/timeUtils';

export interface RecordingModalOptions {
    appendToActiveNote: boolean;
    onlyTranscribe: boolean;
    saveAudioFile: boolean;
    diaryEntryDate: string;
    selectedTemplate: string;
}

/**
 * Modal for audio recording with controls and options
 */
export class RecordingModal extends Modal {
    private plugin: VoiceAIJournalPlugin;
    private recordingTimer: HTMLElement;
    private startButton: HTMLElement;
    private pauseResumeButton: HTMLElement;
    private stopButton: HTMLElement;
    private resetButton: HTMLElement;
    private timerInterval: number | null = null;
    private options: RecordingModalOptions;
    private isMobile: boolean;
    private scribingMsg: HTMLElement;
    private scribingStatusMsg: HTMLElement;
    private isScribing = false;
    private uploadButton: HTMLElement;
    private processingStep = 0;
    private totalProcessingSteps = 0;
    private finalRecordingTime: number | null = null;
    private wakeLock: any = null; // Store the wake lock object

    constructor(plugin: VoiceAIJournalPlugin) {
        super(plugin.app);
        this.plugin = plugin;
        
        // Detect if running on mobile
        this.isMobile = Platform.isMobile;
        
        // Initialize default options
        this.options = {
            appendToActiveNote: this.plugin.settings.appendToExistingNote,
            onlyTranscribe: false, // Default to false, can be changed in UI
            saveAudioFile: true, // Default to true, can be changed in UI
            diaryEntryDate: this.getCurrentDate(),
            selectedTemplate: this.plugin.settings.defaultTemplate || 'Voice AI Journal'
        };
    }

    onOpen() {
        // Add CSS classes for styling
        this.modalEl.addClass('voice-ai-journal-modal');
        if (this.isMobile) {
            this.modalEl.addClass('voice-ai-journal-modal-mobile');
        }
        
        // Set up the modal content
        this.createModalContent();
        
        // Start the timer update interval
        this.startTimerUpdates();
    }

    onClose() {
        // Clear the timer interval
        if (this.timerInterval !== null) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Reset the final recording time
        this.finalRecordingTime = null;
        
        // Cancel any ongoing recording
        this.plugin.cancelRecording();
        
        // Release the wake lock when closing the modal
        this.releaseWakeLock();
    }

    private createModalContent() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Create container for the modal content
        const container = contentEl.createDiv({ cls: 'voice-ai-journal-container' });
        
        // --- Timer Display ---
        const timerContainer = container.createDiv({ cls: 'vaj-timer-container' });
        this.recordingTimer = timerContainer.createDiv({ cls: 'vaj-timer' });
        this.recordingTimer.setText('00:00.00');
        this.recordingTimer.setAttr('style', [
            'font-size: 1.8rem;',
            'margin: 12px 0;',
            'text-align: center;',
            'width: 100%;',
            'font-weight: bold;',
            'font-family: monospace;'
        ].join(' '));

        // --- Button Controls ---
        const buttonContainer = container.createDiv({ cls: 'vaj-control-buttons-container' });
        buttonContainer.setAttr('style', [
            'width: 100%;',
            'display: flex;',
            'justify-content: center;',
            'margin: 12px 0;'
        ].join(' '));

        // Start button (shown only when inactive)
        // Shared style for equal width and spacing
        const btnSharedStyle = [
            'width: 120px;',
            'margin-right: 12px;',
            'padding: 0;',
            'display: flex;',
            'align-items: center;',
            'justify-content: center;',
            'gap: 6px;',
            'box-sizing: border-box;'
        ].join(' ');

        // Start Button (mic)
        this.startButton = buttonContainer.createEl('button', { cls: 'vaj-btn vaj-btn-start' });
        this.startButton.setAttr('style', btnSharedStyle);
        this.startButton.addEventListener('click', () => this.handleStart());
        this.buildButton(this.startButton, 'mic', 'Start');

        // Reset Button (trash-2)
        this.resetButton = buttonContainer.createEl('button', { cls: 'vaj-btn' });
        this.resetButton.setAttr('style', btnSharedStyle);
        this.resetButton.addEventListener('click', () => this.handleReset());
        this.buildButton(this.resetButton, 'trash-2', 'Reset');
        this.resetButton.style.display = 'none';

        // Pause/Resume Button (circle-pause/circle-play)
        this.pauseResumeButton = buttonContainer.createEl('button', { cls: 'vaj-btn vaj-btn-pause-resume' });
        this.pauseResumeButton.setAttr('style', btnSharedStyle);
        this.pauseResumeButton.addEventListener('click', () => this.handlePauseResume());
        this.pauseResumeButton.style.display = 'none';
        // Initial state
        this.setPauseResumeButton('pause');

        // Complete Button (save)
        this.stopButton = buttonContainer.createEl('button', { cls: 'vaj-btn vaj-btn-save' });
        // Remove margin-right for last button
        this.stopButton.setAttr('style', btnSharedStyle.replace('margin-right: 12px;', ''));
        this.stopButton.addEventListener('click', () => this.handleComplete());
        this.buildButton(this.stopButton, 'save', 'Complete');
        this.stopButton.style.display = 'none';

        // Scribing message (shown when processing)
        this.scribingMsg = container.createDiv({ cls: 'vaj-scribing-msg' });
        this.scribingMsg.setText('♽ Voice AI Journal in progress');
        this.scribingMsg.setAttr('style', [
            'font-size: 1em;',
            'margin: 12px 0 4px 0;',
            'text-align: center;',
            'display: none;'
        ].join(' '));
        
        // Add status message element for showing processing steps
        this.scribingStatusMsg = container.createDiv({ cls: 'vaj-scribing-status-msg' });
        this.scribingStatusMsg.setText('');
        this.scribingStatusMsg.setAttr('style', [
            'font-size: 0.9em;',
            'margin: 0 0 12px 0;',
            'text-align: center;',
            'display: none;',
            'color: var(--text-muted);'
        ].join(' '));

        // Initial button state
        this.updateButtonDisplay();
        
        // No microphone info at the top - moved to settings section
        
        // Add separator
        container.createEl('hr');
        
        // Create options section
        this.createOptionsSection(container);
    }

    private createOptionsSection(container: HTMLElement) {
        const optionsContainer = container.createDiv({ cls: 'voice-ai-journal-options-container' });
        
        // Section title
        optionsContainer.createEl('h4', { text: 'Session settings' });
        
        // Append to active note
        new Setting(optionsContainer)
            .setName('Append to active note')
            .addToggle(toggle => toggle
                .setValue(this.options.appendToActiveNote)
                .onChange(value => {
                    this.options.appendToActiveNote = value;
                }));
        
        // Only transcribe recording
        new Setting(optionsContainer)
            .setName('Only transcribe recording')
            .addToggle(toggle => toggle
                .setValue(this.options.onlyTranscribe)
                .onChange(value => {
                    this.options.onlyTranscribe = value;
                }));
        
        // Save audio file
        new Setting(optionsContainer)
            .setName('Save audio file')
            .addToggle(toggle => toggle
                .setValue(this.options.saveAudioFile)
                .onChange(value => {
                    this.options.saveAudioFile = value;
                }));
        
        // Diary entry date
        new Setting(optionsContainer)
            .setName('Diary entry for')
            .addToggle(toggle => toggle
                .setValue(true)
                .onChange(value => {
                    // Toggle visibility of date picker based on toggle value
                    const dateEl = optionsContainer.querySelector('.voice-ai-journal-date-container');
                    if (dateEl) {
                        if (dateEl instanceof HTMLElement) {
                            dateEl.style.display = value ? 'block' : 'none';
                        }
                    }
                }))
            .addText(text => {
                optionsContainer.createDiv({ cls: 'voice-ai-journal-date-container' });
                text.setPlaceholder('YYYY-MM-DD')
                    .setValue(this.options.diaryEntryDate)
                    .onChange(value => {
                        this.options.diaryEntryDate = value;
                    });
                text.inputEl.type = 'date';
                return text;
            });
        
        // Template section removed as requested
        
        // Microphone selection - with proper device enumeration
        new Setting(container)
            .setName('Microphone')
            .setDesc('Select microphone to use for recording')
            .addDropdown(async (dropdown) => {
                // Add default option
                dropdown.addOption('default', 'Default Microphone');
                
                try {
                    // Get all available audio input devices
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
                    
                    // Add each available microphone to the dropdown
                    audioInputDevices.forEach(device => {
                        if (device.deviceId && device.label) {
                            dropdown.addOption(device.deviceId, device.label);
                        }
                    });
                    
                    // Set the current value to the selected microphone or default
                    const currentValue = this.plugin.settings.selectedMicrophoneId || 'default';
                    dropdown.setValue(currentValue);
                    
                    // Handle microphone selection
                    dropdown.onChange(value => {
                        if (value !== 'default') {
                            this.plugin.settings.selectedMicrophoneId = value;
                            this.plugin.saveSettings();
                        } else {
                            this.plugin.settings.selectedMicrophoneId = '';
                            this.plugin.saveSettings();
                        }
                    });
                } catch (error) {
                    console.error('Error enumerating audio devices:', error);
                    new Notice('Failed to get available microphones. Using default.');
                    dropdown.setValue('default');
                }
            });
        
        // Language and model options removed as requested
        
        // Add file upload button (desktop only)
        if (!Platform.isMobile) {
            const uploadContainer = container.createDiv({ cls: 'vaj-upload-container' });
            uploadContainer.setAttr('style', [
                'width: 100%;',
                'display: flex;',
                'justify-content: center;',
                'margin: 12px 0;'
            ].join(' '));
            
            this.uploadButton = uploadContainer.createEl('button', { 
                cls: 'vaj-btn vaj-btn-upload',
                text: 'Upload Audio File'
            });
            
            this.uploadButton.setAttr('style', [
                'width: 100%;',
                'margin-top: 12px;',
                'padding: 8px;',
                'display: flex;',
                'align-items: center;',
                'justify-content: center;',
                'gap: 6px;'
            ].join(' '));
            
            this.buildButton(this.uploadButton, 'upload', 'Upload Audio File');
            
            this.uploadButton.addEventListener('click', this.handleFileUpload.bind(this));
        }
    }
    
    /**
     * Handle file upload button click
     */
    private handleFileUpload() {
        if (this.plugin.aiProviders || this.plugin.settings.transcriptionProvider === 'localWhisper') {
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
                    // Don't close the modal immediately, pass it to processAudioFile
                    await this.plugin.processAudioFile(file, this);
                }
                // Remove the input element
                document.body.removeChild(fileInput);
            });
            
            // Trigger file selection dialog
            fileInput.click();
        } else {
            new Notice('AI providers are not initialized. Please try again in a moment.');
        }
    }

    private startTimerUpdates() {
        // Update the timer every 10ms for smooth display
        this.timerInterval = window.setInterval(() => {
            // If we have a final recording time stored, use that instead of getting the current time
            const recordingTime = this.finalRecordingTime !== null 
                ? this.finalRecordingTime 
                : this.plugin.getRecordingTime();
            this.recordingTimer.setText(formatRecordingTime(recordingTime));
        }, 10);
    }

    private async handleStart() {
        const success = await this.plugin.startRecording();
        
        if (success) {
            // Update UI for recording state
            this.startButton.style.display = 'none';
            this.pauseResumeButton.style.display = 'inline-block';
            this.stopButton.style.display = 'inline-block';
            this.resetButton.style.display = 'inline-block';
            
            // Request wake lock to keep screen on during recording
            await this.requestWakeLock();
        }
    }

    private async handlePauseResume() {
        const recordingState = this.plugin.getRecordingState();
        
        if (recordingState === 'recording' || recordingState === 'paused') {
            const success = await this.plugin.togglePauseResume();
            
            if (success) {
                // Always use the helper to update icon and text
                const isPaused = this.plugin.getRecordingState() === 'paused';
                this.setPauseResumeButton(isPaused ? 'resume' : 'pause');
            }
        }
    }

    private async handleComplete() {
        // Store the final recording time before stopping
        this.finalRecordingTime = this.plugin.getRecordingTime();
        
        // Disable buttons during processing
        this.disableButtons();
        this.isScribing = true;
        this.updateButtonDisplay();
        this.scribingMsg.style.display = '';
        
        // Calculate total processing steps: ASR + Tags + Title + Template Sections + Completion
        // Get the template to count its sections
        const templateId = this.options.selectedTemplate || this.plugin.settings.defaultTemplate || 'Voice AI Journal';
        const template = this.plugin.getTemplateById(templateId);
        const sectionCount = template?.sections?.length || 0;
        
        // Total steps: ASR (1) + Tags (1) + Template Sections + Title + Completion (final)
        this.totalProcessingSteps = 3 + sectionCount + 1; // +1 for completion step
        this.processingStep = 0;
        
        // Initialize with first step
        this.updateProcessingStatus('Transcribing audio...', 1);
        
        // Show processing notice
        new Notice('Voice AI Journal: Processing recording...');
        try {
            // Process the recording with the selected options
            await this.plugin.stopAndProcess({
                appendToActiveNote: this.options.appendToActiveNote,
                onlyTranscribe: this.options.onlyTranscribe,
                saveAudioFile: this.options.saveAudioFile,
                diaryEntryDate: this.options.diaryEntryDate,
                selectedTemplate: this.options.selectedTemplate,
                modalInstance: this // Pass the modal instance to update status
            });
            // Delay closing the modal so users can read the final step
            this.closeWithDelay();
        } catch (error) {
            console.error('[Voice AI Journal] Error processing recording:', error);
            new Notice('Voice AI Journal: Error processing recording');
            // Reset UI to allow retry
            this.isScribing = false;
            this.updateButtonDisplay();
            this.scribingMsg.style.display = 'none';
            this.scribingStatusMsg.style.display = 'none';
            this.resetButtons();
        }
    }

    private handleReset() {
        const recordingState = this.plugin.getRecordingState();
        if (recordingState !== 'inactive') {
            // Clear the final recording time when explicitly resetting
            this.finalRecordingTime = null;
            this.plugin.cancelRecording();
            this.isScribing = false;
            this.updateButtonDisplay();
            this.scribingMsg.style.display = 'none';
            this.scribingStatusMsg.style.display = 'none';
            this.resetButtons();
        }
    }

    private disableButtons() {
        // Disable all buttons during processing
        [this.startButton, this.pauseResumeButton, this.stopButton, this.resetButton].forEach(btn => {
            btn.classList.add('vaj-btn-disabled');
            btn.setAttribute('disabled', 'true');
        });
    }

    private resetButtons() {
        // Reset buttons to initial state
        this.isScribing = false;
        // Force pause/resume button to always show Pause after reset
        this.setPauseResumeButton('pause');
        this.updateButtonDisplay();
        this.scribingMsg.style.display = 'none';
        this.scribingStatusMsg.style.display = 'none';
        // Reset processing steps
        this.processingStep = 0;
        [this.startButton, this.pauseResumeButton, this.stopButton, this.resetButton].forEach(btn => {
            btn.classList.remove('vaj-btn-disabled');
            btn.removeAttribute('disabled');
        });
    }

    // Helper to robustly set a button's icon and text with perfect alignment and sizing
    private buildButton(button: HTMLElement, icon: string, text: string) {
        button.empty();
        // Outer flex container
        const flex = button.createDiv();
        flex.setAttr('style', [
            'display: flex;',
            'flex-direction: row;',
            'align-items: center;',
            'justify-content: center;',
            'width: 100%;',
            'height: 100%;',
            'gap: 8px;'
        ].join(' '));
        // Icon
        const iconSpan = flex.createSpan();
        iconSpan.setAttr('style', 'display: flex; align-items: center; justify-content: center;');
        setIcon(iconSpan, icon);
        // Text
        const textSpan = flex.createSpan();
        textSpan.setAttr('style', 'font-size: 1.1em; line-height: 1;');
        textSpan.setText(text);
    }

    // Helper for pause/resume (always fully rebuilds the button)
    private setPauseResumeButton(state: 'pause' | 'resume') {
        if (state === 'pause') {
            this.buildButton(this.pauseResumeButton, 'circle-pause', 'Pause');
        } else {
            this.buildButton(this.pauseResumeButton, 'circle-play', 'Resume');
        }
    }

    // Update button visibility and text/icons based on state
    private updateButtonDisplay() {
        const state = this.plugin.getRecordingState();
        if (this.isScribing) {
            this.startButton.style.display = 'none';
            this.pauseResumeButton.style.display = 'none';
            this.stopButton.style.display = 'none';
            this.resetButton.style.display = 'none';
            return;
        }
        if (state === 'inactive') {
            this.startButton.style.display = '';
            this.pauseResumeButton.style.display = 'none';
            this.stopButton.style.display = 'none';
            this.resetButton.style.display = 'none';
        } else {
            this.startButton.style.display = 'none';
            this.pauseResumeButton.style.display = '';
            this.stopButton.style.display = '';
            this.resetButton.style.display = '';
            // Pause/Resume icon and text (always with icon)
            if (state === 'paused') {
                this.setPauseResumeButton('resume');
            } else {
                this.setPauseResumeButton('pause');
            }
        }
    }

    /**
     * Update the processing status message
     * @param statusText The status text to display
     * @param step The current processing step (1-based)
     */
    public updateProcessingStatus(statusText: string, step?: number): void {
        if (step !== undefined) {
            this.processingStep = step;
        } else {
            this.processingStep++;
        }
        
        // Update the status message
        this.scribingStatusMsg.setText(`${statusText} (${this.processingStep}/${this.totalProcessingSteps})`);
        this.scribingStatusMsg.style.display = '';
    }
    
    /**
     * Close the modal with a delay to allow the user to read the final status
     * @param delayMs Delay in milliseconds before closing the modal (default: 750ms)
     */
    public closeWithDelay(delayMs = 750): void {
        setTimeout(() => {
            // Release the wake lock before closing the modal
            this.releaseWakeLock();
            this.close();
        }, delayMs);
    }
    
    private getCurrentDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Request a wake lock to keep the screen on
     * This is particularly important for iOS devices where the screen might turn off
     * during processing, potentially interrupting the completion of the task
     */
    private async requestWakeLock(): Promise<void> {
        if ('wakeLock' in navigator) {
            try {
                // Request a screen wake lock
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                
                console.log('[Voice AI Journal] Wake lock acquired');
                
                // Add a listener to reacquire the wake lock if it's released
                this.wakeLock.addEventListener('release', () => {
                    console.log('[Voice AI Journal] Wake lock released');
                    
                    // If we're still recording or processing, try to reacquire the wake lock
                    if (this.plugin.getRecordingState() !== 'inactive' || this.isScribing) {
                        this.requestWakeLock();
                    }
                });
            } catch (err) {
                console.error('[Voice AI Journal] Error acquiring wake lock:', err);
            }
        } else {
            console.log('[Voice AI Journal] Wake Lock API not supported in this browser');
        }
    }
    
    /**
     * Release the wake lock if it's active
     */
    private releaseWakeLock(): void {
        if (this.wakeLock) {
            try {
                this.wakeLock.release();
                this.wakeLock = null;
                console.log('[Voice AI Journal] Wake lock released manually');
            } catch (err) {
                console.error('[Voice AI Journal] Error releasing wake lock:', err);
            }
        }
    }
}
