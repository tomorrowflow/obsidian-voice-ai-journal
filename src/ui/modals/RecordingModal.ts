import { Modal, setIcon, Setting, Notice } from 'obsidian';
import type VoiceAIJournalPlugin from '../../../main';
import { formatRecordingTime } from '../utils/timeUtils';

export interface RecordingModalOptions {
    appendToActiveNote: boolean;
    onlyTranscribe: boolean;
    saveAudioFile: boolean;
    automaticSpeechDetection: boolean;
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

    constructor(plugin: VoiceAIJournalPlugin) {
        super(plugin.app);
        this.plugin = plugin;
        
        // Detect if running on mobile
        this.isMobile = ('isMobile' in this.app) ? Boolean((this.app as unknown as {isMobile: boolean}).isMobile) : false;
        
        // Initialize default options
        this.options = {
            appendToActiveNote: this.plugin.settings.appendToExistingNote,
            onlyTranscribe: false, // Default to false, can be changed in UI
            saveAudioFile: true, // Default to true, can be changed in UI
            automaticSpeechDetection: this.plugin.settings.automaticSpeechDetection,
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
        
        // Cancel any ongoing recording
        this.plugin.cancelRecording();
    }

    private createModalContent() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Create container for the modal content
        const container = contentEl.createDiv({ cls: 'voice-ai-journal-container' });
        
        // Create timer display
        const timerContainer = container.createDiv({ cls: 'voice-ai-journal-timer-container' });
        this.recordingTimer = timerContainer.createDiv({ cls: 'voice-ai-journal-timer' });
        this.recordingTimer.setText('00:00.00');
        
        // Create button container
        const buttonContainer = container.createDiv({ cls: 'voice-ai-journal-button-container' });
        
        // Create start button
        this.startButton = buttonContainer.createDiv({ cls: 'voice-ai-journal-button voice-ai-journal-start-button' });
        setIcon(this.startButton, 'play');
        this.startButton.setText('Start');
        this.startButton.addEventListener('click', () => this.handleStart());
        
        // Create pause/resume button (initially hidden)
        this.pauseResumeButton = buttonContainer.createDiv({ cls: 'voice-ai-journal-button voice-ai-journal-pause-button' });
        setIcon(this.pauseResumeButton, 'pause');
        this.pauseResumeButton.setText('Pause');
        this.pauseResumeButton.style.display = 'none';
        this.pauseResumeButton.addEventListener('click', () => this.handlePauseResume());
        
        // Create stop button (initially hidden)
        this.stopButton = buttonContainer.createDiv({ cls: 'voice-ai-journal-button voice-ai-journal-stop-button' });
        setIcon(this.stopButton, 'check');
        this.stopButton.setText('Complete');
        this.stopButton.style.display = 'none';
        this.stopButton.addEventListener('click', () => this.handleComplete());
        
        // Create reset button (initially hidden)
        this.resetButton = buttonContainer.createDiv({ cls: 'voice-ai-journal-button voice-ai-journal-reset-button' });
        setIcon(this.resetButton, 'trash');
        this.resetButton.setText('Reset');
        this.resetButton.style.display = 'none';
        this.resetButton.addEventListener('click', () => this.handleReset());
        
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
        
        // Multi-speaker detection (if supported)
        new Setting(optionsContainer)
            .setName('Multi-speaker enabled')
            .addToggle(toggle => toggle
                .setValue(this.options.automaticSpeechDetection)
                .onChange(value => {
                    this.options.automaticSpeechDetection = value;
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
    }

    private startTimerUpdates() {
        // Update the timer every 10ms for smooth display
        this.timerInterval = window.setInterval(() => {
            const recordingTime = this.plugin.getRecordingTime();
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
        }
    }

    private async handlePauseResume() {
        const recordingState = this.plugin.getRecordingState();
        
        if (recordingState === 'recording' || recordingState === 'paused') {
            const success = await this.plugin.togglePauseResume();
            
            if (success) {
                // Update button icon and text based on new state
                const isPaused = this.plugin.getRecordingState() === 'paused';
                
                if (isPaused) {
                    setIcon(this.pauseResumeButton, 'play');
                    this.pauseResumeButton.setText('Resume');
                } else {
                    setIcon(this.pauseResumeButton, 'pause');
                    this.pauseResumeButton.setText('Pause');
                }
            }
        }
    }

    private async handleComplete() {
        // Disable buttons during processing
        this.disableButtons();
        
        // Show processing notice
        new Notice('Voice AI Journal: Processing recording...');
        
        try {
            // Process the recording with the selected options
            await this.plugin.stopAndProcess({
                appendToActiveNote: this.options.appendToActiveNote,
                onlyTranscribe: this.options.onlyTranscribe,
                saveAudioFile: this.options.saveAudioFile,
                automaticSpeechDetection: this.options.automaticSpeechDetection,
                diaryEntryDate: this.options.diaryEntryDate,
                selectedTemplate: this.options.selectedTemplate
            });
            
            // Close the modal when done
            this.close();
        } catch (error) {
            console.error('[Voice AI Journal] Error processing recording:', error);
            new Notice('Voice AI Journal: Error processing recording');
            
            // Reset UI to allow retry
            this.resetButtons();
        }
    }

    private handleReset() {
        const recordingState = this.plugin.getRecordingState();
        
        if (recordingState !== 'inactive') {
            this.plugin.cancelRecording();
            this.resetButtons();
        }
    }

    private disableButtons() {
        // Disable all buttons during processing
        this.startButton.classList.add('voice-ai-journal-button-disabled');
        this.pauseResumeButton.classList.add('voice-ai-journal-button-disabled');
        this.stopButton.classList.add('voice-ai-journal-button-disabled');
        this.resetButton.classList.add('voice-ai-journal-button-disabled');
        
        this.startButton.setAttribute('disabled', 'true');
        this.pauseResumeButton.setAttribute('disabled', 'true');
        this.stopButton.setAttribute('disabled', 'true');
        this.resetButton.setAttribute('disabled', 'true');
    }

    private resetButtons() {
        // Reset buttons to initial state
        this.startButton.style.display = 'inline-block';
        this.pauseResumeButton.style.display = 'none';
        this.stopButton.style.display = 'none';
        this.resetButton.style.display = 'none';
        
        // Remove disabled state
        this.startButton.classList.remove('voice-ai-journal-button-disabled');
        this.pauseResumeButton.classList.remove('voice-ai-journal-button-disabled');
        this.stopButton.classList.remove('voice-ai-journal-button-disabled');
        this.resetButton.classList.remove('voice-ai-journal-button-disabled');
        
        this.startButton.removeAttribute('disabled');
        this.pauseResumeButton.removeAttribute('disabled');
        this.stopButton.removeAttribute('disabled');
        this.resetButton.removeAttribute('disabled');
    }

    private getCurrentDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
}
