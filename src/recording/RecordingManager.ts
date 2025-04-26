import { Notice } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';

export type RecordingState = 'inactive' | 'recording' | 'paused';

/**
 * Manages audio recording functionality
 */
export class RecordingManager {
    private plugin: VoiceAIJournalPlugin;
    private chunks: BlobPart[] = [];
    private mediaRecorder: MediaRecorder | null = null;
    private recordingState: RecordingState = 'inactive';
    private recordingStartTime: number | null = null;
    private recordingPausedDuration: number = 0;
    private lastPausedTime: number | null = null;

    constructor(plugin: VoiceAIJournalPlugin) {
        this.plugin = plugin;
    }

    /**
     * Get the current recording state
     */
    public getRecordingState(): RecordingState {
        return this.recordingState;
    }

    /**
     * Get the current recording time in milliseconds
     */
    public getRecordingTime(): number {
        if (this.recordingStartTime === null) {
            return 0;
        }

        if (this.recordingState === 'paused' && this.lastPausedTime !== null) {
            return this.lastPausedTime - this.recordingStartTime - this.recordingPausedDuration;
        }

        return Date.now() - this.recordingStartTime - this.recordingPausedDuration;
    }

    /**
     * Start recording audio
     * @returns Promise that resolves to true if recording started successfully
     */
    public async startRecording(): Promise<boolean> {
        if (this.recordingState !== 'inactive') {
            console.log('[Voice AI Journal] Recording already in progress');
            return false;
        }

        this.chunks = []; // Clear any previous recording chunks
        
        // Get the selected microphone ID from settings
        const selectedMicrophoneId = this.plugin.settings.selectedMicrophoneId;
        
        // Configure audio constraints based on selected microphone
        const audioConstraints = selectedMicrophoneId 
            ? { deviceId: { exact: selectedMicrophoneId } }
            : true;

        try {
            console.log('[Voice AI Journal] Requesting microphone access');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            console.log('[Voice AI Journal] Microphone access granted');
            
            // Try to create MediaRecorder with preferred settings
            try {
                this.mediaRecorder = new MediaRecorder(stream);
                
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        this.chunks.push(e.data);
                    }
                };
                
                // Start recording with relatively frequent data collection
                this.mediaRecorder.start(250);
                console.log('[Voice AI Journal] MediaRecorder started');
                this.recordingState = 'recording';
                this.recordingStartTime = Date.now();
                this.recordingPausedDuration = 0;
                this.lastPausedTime = null;
                return true;
            } catch (recorderError) {
                console.error('[Voice AI Journal] MediaRecorder error:', recorderError);
                
                // Try with fallback MIME type options
                try {
                    // Try with common MIME types that work on most devices
                    const mimeTypes = [
                        'audio/webm',
                        'audio/mp4',
                        'audio/ogg',
                        'audio/wav'
                    ];
                    
                    // Try each MIME type until one works
                    for (const mimeType of mimeTypes) {
                        try {
                            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
                            break;
                        } catch (e) {
                            console.log(`[Voice AI Journal] MIME type ${mimeType} not supported`);
                        }
                    }
                    
                    // If we still don't have a MediaRecorder, throw an error
                    if (!this.mediaRecorder) {
                        throw new Error('No supported MIME types found');
                    }
                    
                    this.mediaRecorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) {
                            this.chunks.push(e.data);
                        }
                    };
                    
                    this.mediaRecorder.start(250);
                    console.log('[Voice AI Journal] MediaRecorder started with fallback MIME type');
                    this.recordingState = 'recording';
                    this.recordingStartTime = Date.now();
                    this.recordingPausedDuration = 0;
                    this.lastPausedTime = null;
                    return true;
                } catch (fallbackError) {
                    console.error('[Voice AI Journal] Fallback MediaRecorder error:', fallbackError);
                    new Notice('Voice AI Journal: Failed to start recording');
                    return false;
                }
            }
        } catch (err) {
            new Notice('Voice AI Journal: Failed to access the microphone');
            console.error('[Voice AI Journal] Error accessing microphone:', err);
            return false;
        }
    }

    /**
     * Pause the current recording
     * @returns Promise that resolves to true if recording paused successfully
     */
    public async pauseRecording(): Promise<boolean> {
        if (this.recordingState !== 'recording' || !this.mediaRecorder) {
            console.log('[Voice AI Journal] Cannot pause: not currently recording');
            return false;
        }
        
        try {
            console.log('[Voice AI Journal] Pausing recording...');
            this.mediaRecorder.pause();
            this.recordingState = 'paused';
            this.lastPausedTime = Date.now();
            console.log('[Voice AI Journal] Recording paused');
            return true;
        } catch (error) {
            console.error('[Voice AI Journal] Error pausing recording:', error);
            new Notice('Voice AI Journal: Failed to pause recording');
            return false;
        }
    }

    /**
     * Resume a paused recording
     * @returns Promise that resolves to true if recording resumed successfully
     */
    public async resumeRecording(): Promise<boolean> {
        if (this.recordingState !== 'paused' || !this.mediaRecorder) {
            console.log('[Voice AI Journal] Cannot resume: not currently paused');
            return false;
        }
        
        try {
            console.log('[Voice AI Journal] Resuming recording...');
            this.mediaRecorder.resume();
            this.recordingState = 'recording';
            
            // Update paused duration
            if (this.lastPausedTime !== null) {
                this.recordingPausedDuration += (Date.now() - this.lastPausedTime);
                this.lastPausedTime = null;
            }
            
            console.log('[Voice AI Journal] Recording resumed');
            return true;
        } catch (error) {
            console.error('[Voice AI Journal] Error resuming recording:', error);
            new Notice('Voice AI Journal: Failed to resume recording');
            return false;
        }
    }

    /**
     * Toggle between pause and resume
     * @returns Promise that resolves to true if operation was successful
     */
    public async togglePauseResume(): Promise<boolean> {
        if (this.recordingState === 'recording') {
            return this.pauseRecording();
        } else if (this.recordingState === 'paused') {
            return this.resumeRecording();
        }
        
        console.error('[Voice AI Journal] Cannot toggle pause/resume: invalid state');
        return false;
    }

    /**
     * Stop recording and return the audio blob
     * @returns Promise that resolves to the recorded audio blob
     */
    public stopRecording(): Promise<Blob> {
        if (this.recordingState === 'inactive' || !this.mediaRecorder) {
            console.log('[Voice AI Journal] No active recording to stop');
            return Promise.reject(new Error('No active recording to stop'));
        }

        return new Promise<Blob>((resolve, reject) => {
            try {
                console.log('[Voice AI Journal] Stopping recording...');
                // We've checked mediaRecorder isn't null above, but let's be extra safe
                if (!this.mediaRecorder) {
                    throw new Error('MediaRecorder is unexpectedly null');
                }
                
                const mediaRecorder = this.mediaRecorder;
                
                // Request one final chunk of data before stopping
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.requestData();
                }

                mediaRecorder.onstop = () => {
                    console.log(`[Voice AI Journal] MediaRecorder stopped. Creating Blob from ${this.chunks.length} chunks`);
                    
                    // Get the MIME type from the MediaRecorder
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    
                    // Create the blob with the proper MIME type
                    const blob = new Blob(this.chunks, { type: mimeType });
                    
                    console.log(`[Voice AI Journal] Created blob size: ${blob.size} bytes, mime type: ${mimeType}`);
                    
                    // Reset recording state
                    this.chunks = [];
                    this.recordingState = 'inactive';
                    this.mediaRecorder = null;
                    this.recordingStartTime = null;
                    this.recordingPausedDuration = 0;
                    this.lastPausedTime = null;
                    
                    resolve(blob);
                };

                // Stop the MediaRecorder and all tracks
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach((track) => {
                    track.stop();
                    console.log(`[Voice AI Journal] Track stopped: ${track.kind}`);
                });
            } catch (error) {
                console.error('[Voice AI Journal] Error stopping recording:', error);
                reject(error);
            }
        });
    }

    /**
     * Cancel the current recording
     * @returns Promise that resolves when the recording has been cancelled
     */
    public async cancelRecording(): Promise<void> {
        if (this.recordingState === 'inactive' || !this.mediaRecorder) {
            console.log('[Voice AI Journal] No active recording to cancel');
            return;
        }
        
        try {
            // Stop the MediaRecorder and all tracks
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach((track) => {
                track.stop();
            });
            
            // Reset recording state
            this.chunks = [];
            this.recordingState = 'inactive';
            this.mediaRecorder = null;
            this.recordingStartTime = null;
            this.recordingPausedDuration = 0;
            this.lastPausedTime = null;
            
            console.log('[Voice AI Journal] Recording cancelled');
        } catch (error) {
            console.error('[Voice AI Journal] Error cancelling recording:', error);
        }
    }

    /**
     * Check if microphone access is available
     * @returns Promise that resolves to true if microphone access is available
     */
    public async checkMicrophoneAccess(): Promise<boolean> {
        try {
            // Get the selected microphone ID from settings
            const selectedMicrophoneId = this.plugin.settings.selectedMicrophoneId;
            
            // Configure audio constraints based on selected microphone
            const audioConstraints = selectedMicrophoneId 
                ? { deviceId: { exact: selectedMicrophoneId } }
                : true;
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            
            // If we get here, we have access, so stop all tracks and return true
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('[Voice AI Journal] Microphone access error:', error);
            return false;
        }
    }

    /**
     * Get the recorded audio's MIME type
     * @returns The MIME type of the recorded audio, or null if no recording
     */
    public getRecordingMimeType(): string | null {
        if (!this.mediaRecorder) {
            return null;
        }
        
        return this.mediaRecorder.mimeType || 'audio/webm';
    }

    /**
     * Get the file extension for the recorded audio based on MIME type
     * @returns The file extension (with dot prefix) for the recorded audio
     */
    public getRecordingFileExtension(): string {
        const mimeType = this.getRecordingMimeType()?.toLowerCase() || 'audio/webm';
        
        // Map MIME types to file extensions
        const extensionMap: Record<string, string> = {
            'audio/webm': '.webm',
            'audio/ogg': '.ogg',
            'audio/mp4': '.m4a',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'audio/x-wav': '.wav'
        };
        
        return extensionMap[mimeType] || '.webm';
    }
}
