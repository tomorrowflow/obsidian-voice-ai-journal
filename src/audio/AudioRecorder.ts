import { Notice } from 'obsidian';

/**
 * Supported audio MIME types and their file extensions
 */
export type SupportedMimeType = 
    | 'audio/webm; codecs=opus'
    | 'audio/webm'
    | 'audio/ogg; codecs=opus'
    | 'audio/mp4';

interface AudioQualitySettings {
    mimeType: SupportedMimeType;
    bitRate: number;
}

const AUDIO_QUALITY_SETTINGS: Record<'low' | 'medium' | 'high', AudioQualitySettings> = {
    low: {
        mimeType: 'audio/webm; codecs=opus',
        bitRate: 16000
    },
    medium: {
        mimeType: 'audio/webm; codecs=opus',
        bitRate: 32000
    },
    high: {
        mimeType: 'audio/webm; codecs=opus',
        bitRate: 48000
    }
};

/**
 * Class to handle audio recording functionality
 */
export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private recordingChunks: BlobPart[] = [];
    private stream: MediaStream | null = null;
    private qualitySetting: 'low' | 'medium' | 'high';
    private recordingStartTime: number = 0;
    private recordingDuration: number = 0;
    private pauseStartTime: number = 0;
    private isRecording: boolean = false;
    private isPaused: boolean = false;
    private timerInterval: number | null = null;
    
    // Event callbacks
    private onStatusChangeCallback: ((status: RecordingStatus) => void) | null = null;
    private onTimeUpdateCallback: ((time: number) => void) | null = null;
    private onErrorCallback: ((error: Error) => void) | null = null;

    constructor(quality: 'low' | 'medium' | 'high' = 'medium') {
        this.qualitySetting = quality;
    }

    /**
     * Start recording audio
     */
    async startRecording(): Promise<boolean> {
        if (this.isRecording) {
            return false;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const settings = AUDIO_QUALITY_SETTINGS[this.qualitySetting];
            
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: this.getSupportedMimeType(settings.mimeType),
                audioBitsPerSecond: settings.bitRate
            });
            
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.recordingChunks.push(e.data);
                }
            };
            
            this.mediaRecorder.onerror = (e) => {
                this.triggerError(new Error('Recording error: ' + e.error));
            };
            
            this.recordingChunks = [];
            this.recordingStartTime = Date.now();
            this.recordingDuration = 0;
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.isPaused = false;
            
            this.startTimer();
            this.triggerStatusChange('recording');
            
            return true;
        } catch (error) {
            this.triggerError(error instanceof Error ? error : new Error('Failed to start recording'));
            return false;
        }
    }

    /**
     * Pause the current recording
     */
    pauseRecording(): boolean {
        if (!this.isRecording || !this.mediaRecorder || this.isPaused) {
            return false;
        }

        try {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseStartTime = Date.now();
            this.stopTimer();
            this.triggerStatusChange('paused');
            return true;
        } catch (error) {
            this.triggerError(error instanceof Error ? error : new Error('Failed to pause recording'));
            return false;
        }
    }

    /**
     * Resume a paused recording
     */
    resumeRecording(): boolean {
        if (!this.isRecording || !this.mediaRecorder || !this.isPaused) {
            return false;
        }

        try {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.startTimer();
            this.triggerStatusChange('recording');
            return true;
        } catch (error) {
            this.triggerError(error instanceof Error ? error : new Error('Failed to resume recording'));
            return false;
        }
    }

    /**
     * Stop the recording and return the recorded audio blob
     */
    async stopRecording(): Promise<Blob | null> {
        if (!this.isRecording || !this.mediaRecorder) {
            return null;
        }

        return new Promise((resolve) => {
            // Set up the onstop event handler to resolve the promise
            this.mediaRecorder!.onstop = () => {
                this.isRecording = false;
                this.isPaused = false;
                this.stopTimer();
                
                if (this.recordingChunks.length === 0) {
                    resolve(null);
                    return;
                }
                
                const mimeType = this.mediaRecorder!.mimeType;
                const blob = new Blob(this.recordingChunks, { type: mimeType });
                
                this.recordingChunks = [];
                this.mediaRecorder = null;
                
                // Stop all tracks
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }
                
                this.triggerStatusChange('stopped');
                resolve(blob);
            };
            
            // Create an empty event handler for error during stop
            this.mediaRecorder!.onerror = null;
            
            // Stop recording
            try {
                this.mediaRecorder!.stop();
            } catch (error) {
                this.triggerError(error instanceof Error ? error : new Error('Failed to stop recording'));
                resolve(null);
            }
        });
    }

    /**
     * Cancel the current recording without saving
     */
    cancelRecording(): void {
        if (!this.isRecording) {
            return;
        }

        this.stopTimer();
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try {
                this.mediaRecorder.stop();
            } catch (error) {
                console.error('Error stopping MediaRecorder:', error);
            }
        }
        
        this.recordingChunks = [];
        this.mediaRecorder = null;
        this.isRecording = false;
        this.isPaused = false;
        
        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.triggerStatusChange('stopped');
    }

    /**
     * Get the duration of the recording in milliseconds
     */
    getRecordingDuration(): number {
        return this.recordingDuration;
    }

    /**
     * Get the current recording status
     */
    getStatus(): RecordingStatus {
        if (!this.isRecording) {
            return 'stopped';
        }
        return this.isPaused ? 'paused' : 'recording';
    }

    /**
     * Set the audio quality
     */
    setQuality(quality: 'low' | 'medium' | 'high'): void {
        this.qualitySetting = quality;
    }

    /**
     * Check if a specific MIME type is supported
     */
    private getSupportedMimeType(preferred: SupportedMimeType): SupportedMimeType {
        const mimeTypes: SupportedMimeType[] = [
            'audio/webm; codecs=opus',
            'audio/webm',
            'audio/ogg; codecs=opus',
            'audio/mp4'
        ];
        
        // Try the preferred type first
        if (MediaRecorder.isTypeSupported(preferred)) {
            return preferred;
        }
        
        // Then try others
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        
        // Fall back to default
        return 'audio/webm';
    }

    /**
     * Get the file extension for the current MIME type
     */
    getFileExtension(): string {
        if (!this.mediaRecorder) {
            return '.webm';
        }
        
        const mimeType = this.mediaRecorder.mimeType;
        
        if (mimeType.includes('webm')) {
            return '.webm';
        } else if (mimeType.includes('ogg')) {
            return '.ogg';
        } else if (mimeType.includes('mp4')) {
            return '.m4a';
        } else {
            return '.webm'; // default
        }
    }

    /**
     * Start the timer to track recording duration
     */
    private startTimer(): void {
        if (this.timerInterval !== null) {
            window.clearInterval(this.timerInterval);
        }
        
        this.timerInterval = window.setInterval(() => {
            const now = Date.now();
            this.recordingDuration = now - this.recordingStartTime;
            
            if (this.onTimeUpdateCallback) {
                this.onTimeUpdateCallback(this.recordingDuration);
            }
        }, 100);
    }

    /**
     * Stop the timer
     */
    private stopTimer(): void {
        if (this.timerInterval !== null) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Trigger a recording status change event
     */
    private triggerStatusChange(status: RecordingStatus): void {
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(status);
        }
    }

    /**
     * Trigger an error event
     */
    private triggerError(error: Error): void {
        console.error('AudioRecorder error:', error);
        
        if (this.onErrorCallback) {
            this.onErrorCallback(error);
        } else {
            new Notice(`Recording error: ${error.message}`);
        }
    }

    /**
     * Set callback for recording status changes
     */
    onStatusChange(callback: (status: RecordingStatus) => void): void {
        this.onStatusChangeCallback = callback;
    }

    /**
     * Set callback for timer updates
     */
    onTimeUpdate(callback: (time: number) => void): void {
        this.onTimeUpdateCallback = callback;
    }

    /**
     * Set callback for errors
     */
    onError(callback: (error: Error) => void): void {
        this.onErrorCallback = callback;
    }
}

export type RecordingStatus = 'recording' | 'paused' | 'stopped';
