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

// Detect if running on iOS
const isIOS = (): boolean => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if a specific MIME type is supported by the browser
const isMimeTypeSupported = (mimeType: string): boolean => {
    try {
        return MediaRecorder.isTypeSupported(mimeType);
    } catch (e) {
        console.error(`[Voice AI Journal] Error checking MIME type support for ${mimeType}:`, e);
        return false;
    }
};

// Determine the best default MIME type based on browser support
const getBestDefaultMimeType = (): SupportedMimeType => {
    // Preferred order: MP4 (most compatible), WebM with Opus, WebM, Ogg with Opus
    const preferredTypes: SupportedMimeType[] = [
        'audio/mp4',
        'audio/webm; codecs=opus',
        'audio/webm',
        'audio/ogg; codecs=opus'
    ];
    
    for (const type of preferredTypes) {
        if (isMimeTypeSupported(type)) {
            console.log(`[Voice AI Journal] Using supported MIME type: ${type}`);
            return type;
        }
    }
    
    // If none are supported, return WebM as fallback (most browsers support this)
    console.log('[Voice AI Journal] No preferred MIME types supported, falling back to WebM');
    return 'audio/webm';
};

// Get the best default MIME type once at initialization
const bestDefaultMimeType = getBestDefaultMimeType();

const AUDIO_QUALITY_SETTINGS: Record<'low' | 'medium' | 'high', AudioQualitySettings> = {
    low: {
        mimeType: bestDefaultMimeType,
        bitRate: 16000
    },
    medium: {
        mimeType: bestDefaultMimeType,
        bitRate: 32000
    },
    high: {
        mimeType: bestDefaultMimeType,
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
    private recordingStartTime: number;
    private recordingDuration: number;
    private pauseStartTime: number;
    private isRecording: boolean;
    private isPaused: boolean;
    private timerInterval: number | null;
    
    // Event callbacks
    private onStatusChangeCallback: ((status: RecordingStatus) => void);
    private onTimeUpdateCallback: ((time: number) => void);
    private onErrorCallback: ((error: Error) => void);

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
            // Store mediaRecorder in a local variable to ensure it's not null
            const mediaRecorder = this.mediaRecorder;
            if (!mediaRecorder) {
                console.error('[Voice AI Journal] MediaRecorder is null in stopRecording');
                resolve(null);
                return;
            }
            
            // Set up the onstop event handler to resolve the promise
            mediaRecorder.onstop = () => {
                this.isRecording = false;
                this.isPaused = false;
                this.stopTimer();
                
                if (this.recordingChunks.length === 0) {
                    resolve(null);
                    return;
                }
                
                const mimeType = mediaRecorder.mimeType;
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
            mediaRecorder.onerror = null;
            
            // Stop recording
            try {
                mediaRecorder.stop();
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
        // Always try to use the preferred type first if it's supported
        if (isMimeTypeSupported(preferred)) {
            console.log(`[Voice AI Journal] Using preferred format: ${preferred}`);
            return preferred;
        }
        
        // Define priority order based on platform and compatibility
        const priorityMimeTypes: SupportedMimeType[] = isIOS()
            ? [
                // iOS priority - MP4 first, then others
                'audio/mp4',
                'audio/webm',
                'audio/webm; codecs=opus',
                'audio/ogg; codecs=opus'
              ]
            : [
                // Non-iOS priority - Try MP4 first for compatibility, then others
                'audio/mp4',
                'audio/webm; codecs=opus',
                'audio/webm',
                'audio/ogg; codecs=opus'
              ];
        
        // Try each type in priority order
        for (const type of priorityMimeTypes) {
            if (isMimeTypeSupported(type)) {
                console.log(`[Voice AI Journal] Using supported format: ${type}`);
                return type;
            }
        }
        
        // If we get here, no supported types were found
        console.warn('[Voice AI Journal] No supported audio format found, falling back to WebM');
        return 'audio/webm';
    }

    /**
     * Get the file extension for the current MIME type
     */
    getFileExtension(): string {
        if (!this.mediaRecorder) {
            // Default to m4a on iOS, webm otherwise
            const defaultExt = isIOS() ? '.m4a' : '.webm';
            console.log(`[Voice AI Journal] No media recorder, using default extension: ${defaultExt}`);
            return defaultExt;
        }
        
        const mimeType = this.mediaRecorder.mimeType;
        console.log(`[Voice AI Journal] Current recording MIME type: ${mimeType}`);
        
        if (mimeType.includes('webm')) {
            return '.webm';
        } else if (mimeType.includes('ogg')) {
            return '.ogg';
        } else if (mimeType.includes('mp4')) {
            return '.m4a'; // Use m4a extension for MP4 audio
        } else if (isIOS()) {
            // Fallback for iOS - use m4a if we can't determine from MIME type
            return '.m4a';
        } else {
            return '.webm'; // default fallback for other platforms
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
