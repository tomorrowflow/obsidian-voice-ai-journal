import { TFile } from 'obsidian';
import { AudioRecorder, RecordingStatus } from './AudioRecorder';

export interface AudioProcessingOptions {
    saveToVault: boolean;
    recordingsFolder: string;
    fileName?: string;
    includeTimestamp: boolean;
}

export interface AudioProcessingResult {
    audioBlob: Blob;
    filePath?: string;
    file?: TFile;
    fileExtension: string;
    mimeType: string;
    duration: number;
}

export interface AudioUploadResult {
    file: TFile;
    filePath: string;
    fileExtension: string;
    mimeType: string;
}

/**
 * AudioManager - Handles both recording and file upload functionality
 * Centralizes audio handling logic in one place
 */
export class AudioManager {
    private audioRecorder: AudioRecorder;
    private onStatusChangeCallback: ((status: RecordingStatus) => void) | null = null;
    private onTimeUpdateCallback: ((time: number) => void) | null = null;
    private onErrorCallback: ((error: Error) => void) | null = null;

    constructor(quality: 'low' | 'medium' | 'high' = 'medium') {
        this.audioRecorder = new AudioRecorder(quality);
        
        // Forward event callbacks to the recorder
        this.audioRecorder.onStatusChange((status) => {
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback(status);
            }
        });
        
        this.audioRecorder.onTimeUpdate((time) => {
            if (this.onTimeUpdateCallback) {
                this.onTimeUpdateCallback(time);
            }
        });
        
        this.audioRecorder.onError((error) => {
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
        });
    }

    /**
     * Check if the microphone is accessible
     */
    async checkMicrophoneAccess(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Release the stream immediately after testing
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Microphone access error:', error);
            return false;
        }
    }

    /**
     * Start recording audio
     */
    async startRecording(): Promise<boolean> {
        return this.audioRecorder.startRecording();
    }

    /**
     * Pause the current recording
     */
    pauseRecording(): boolean {
        return this.audioRecorder.pauseRecording();
    }

    /**
     * Resume a paused recording
     */
    resumeRecording(): boolean {
        return this.audioRecorder.resumeRecording();
    }

    /**
     * Toggle between pause and resume
     */
    togglePauseResume(): boolean {
        const status = this.audioRecorder.getStatus();
        if (status === 'paused') {
            return this.audioRecorder.resumeRecording();
        } else if (status === 'recording') {
            return this.audioRecorder.pauseRecording();
        }
        return false;
    }

    /**
     * Stop recording and process the audio
     */
    async stopRecording(options?: AudioProcessingOptions): Promise<AudioProcessingResult | null> {
        const blob = await this.audioRecorder.stopRecording();
        if (!blob) {
            return null;
        }

        // If we don't need to save the file, just return the blob
        if (!options || !options.saveToVault) {
            return {
                audioBlob: blob,
                fileExtension: this.audioRecorder.getFileExtension(),
                mimeType: blob.type,
                duration: this.audioRecorder.getRecordingDuration()
            };
        }

        // Process and save the recording to the vault
        return this.processRecordingBlob(blob, options);
    }

    /**
     * Cancel the current recording without saving
     */
    cancelRecording(): void {
        this.audioRecorder.cancelRecording();
    }

    /**
     * Get the current recording status
     */
    getRecordingStatus(): RecordingStatus {
        return this.audioRecorder.getStatus();
    }

    /**
     * Get the current recording duration in milliseconds
     */
    getRecordingDuration(): number {
        return this.audioRecorder.getRecordingDuration();
    }

    /**
     * Set the audio recording quality
     */
    setQuality(quality: 'low' | 'medium' | 'high'): void {
        this.audioRecorder.setQuality(quality);
    }

    /**
     * Process an uploaded audio file
     * @param file The file object from a file input
     * @param options Processing options
     */
    async processUploadedFile(
        file: File, 
        app: any, 
        options: AudioProcessingOptions
    ): Promise<AudioUploadResult> {
        try {
            // Extract file extension from file name
            const fileNameParts = file.name.split('.');
            const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop() || 'mp3' : 'mp3';
            
            // Prepare file path
            const recordingsFolder = options.recordingsFolder || 'Recordings';
            
            // Create filename
            let fileName = options.fileName || file.name;
            
            // Add timestamp if requested
            if (options.includeTimestamp) {
                const timestamp = new Date().toISOString().replace(/[:T-]/g, '').slice(0, 14);
                fileName = `${fileNameParts.join('.')}-${timestamp}.${fileExtension}`;
            }
            
            const filePath = `${recordingsFolder}/${fileName}`;
            
            // Convert File to ArrayBuffer
            const buffer = await file.arrayBuffer();
            const array = new Uint8Array(buffer);
            
            // Save to vault
            const savedFile = await app.vault.createBinary(filePath, array);
            
            return {
                file: savedFile,
                filePath,
                fileExtension: `.${fileExtension}`,
                mimeType: file.type
            };
        } catch (error) {
            console.error('Error processing uploaded file:', error);
            throw new Error(`Failed to process audio file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Process and save a recording blob to the vault
     * @private
     */
    private async processRecordingBlob(
        blob: Blob, 
        options: AudioProcessingOptions
    ): Promise<AudioProcessingResult> {
        // This is a placeholder - actual implementation will depend on how you save files to the vault
        // You'll need to inject the app object or a FileService from the plugin
        
        // Return a skeleton result for now
        return {
            audioBlob: blob,
            fileExtension: this.audioRecorder.getFileExtension(),
            mimeType: blob.type,
            duration: this.audioRecorder.getRecordingDuration()
        };
    }

    /**
     * Set callback for recording status changes
     */
    onStatusChange(callback: (status: RecordingStatus) => void): void {
        this.onStatusChangeCallback = callback;
        this.audioRecorder.onStatusChange(callback);
    }

    /**
     * Set callback for timer updates
     */
    onTimeUpdate(callback: (time: number) => void): void {
        this.onTimeUpdateCallback = callback;
        this.audioRecorder.onTimeUpdate(callback);
    }

    /**
     * Set callback for errors
     */
    onError(callback: (error: Error) => void): void {
        this.onErrorCallback = callback;
        this.audioRecorder.onError(callback);
    }
}
