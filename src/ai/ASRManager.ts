import { TFile, Notice, requestUrl } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';

/**
 * Result of a transcription operation
 */
export interface TranscriptionResult {
    text: string;
    detectedLanguage?: string; // Full language name (e.g., 'English', 'German')
    languageCode?: string; // ISO language code (e.g., 'en', 'de')
}

/**
 * Manager for Automatic Speech Recognition functionality
 */
export class ASRManager {
    /**
     * @param plugin Plugin instance
     */
    constructor(private plugin: VoiceAIJournalPlugin) {}

    /**
     * Transcribe audio data to text
     * @param audioBlob Audio data as a blob
     * @param language Language code for transcription, or 'auto' for automatic detection
     * @param fileExtension Optional file extension to determine MIME type
     * @returns Promise that resolves to transcription text
     */
    async transcribeAudio(audioBlob: Blob, language = 'auto', fileExtension = 'wav'): Promise<TranscriptionResult> {
        // Select the transcription method based on the settings
        if (this.plugin.settings.transcriptionProvider === 'localWhisper') {
            return this.transcribeWithLocalWhisper(audioBlob, language, fileExtension);
        } else {
            return this.transcribeWithAIProviders(audioBlob, language);
        }
    }

    /**
     * Transcribe audio file from vault
     * @param file The file to transcribe
     * @param language Language code for transcription, or 'auto' for automatic detection
     * @returns Promise that resolves to transcription text
     */
    async transcribeAudioFileFromVault(file: TFile, language = 'auto'): Promise<TranscriptionResult> {
        try {
            // Read the file from the vault
            const arrayBuffer = await this.plugin.app.vault.readBinary(file);
            
            // Get the file extension
            const extension = file.extension.toLowerCase();
            
            // Map file extensions to MIME types
            const mimeTypeMap: Record<string, string> = {
                'webm': 'audio/webm',
                'mp3': 'audio/mpeg',
                'mp4': 'audio/mp4',
                'm4a': 'audio/mp4',
                'wav': 'audio/wav',
                'ogg': 'audio/ogg',
                'flac': 'audio/flac'
            };
            
            // Get the correct MIME type based on the file extension
            const mimeType = mimeTypeMap[extension] || 'audio/wav';
            
            // Convert to blob with the correct MIME type
            const blob = new Blob([arrayBuffer], { type: mimeType });
            
            // Transcribe using the selected method, passing the file extension
            return await this.transcribeAudio(blob, language, extension);
        } catch (error) {
            console.error('Failed to transcribe audio file from vault:', error);
            throw new Error(`Failed to transcribe audio file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Transcribe audio to text using AI Providers
     *
     * @param audioBlob Audio blob to transcribe
     * @param language Language code for transcription
     * @returns Promise that resolves to a TranscriptionResult
     */
    private async transcribeWithAIProviders(audioBlob: Blob, language: string): Promise<TranscriptionResult> {
        const aiProviders = this.plugin.aiProviders;
        if (!aiProviders) {
            throw new Error('AI Providers not initialized');
        }
        
        try {
            // Convert audio to base64
            const base64Audio = await this.blobToBase64(audioBlob);
            
            // Get provider ID from settings or use default
            const providerId = this.plugin.settings.aiProviders?.transcription;
            
            // Build prompt with language instructions if needed
            let systemPrompt = 'Transcribe the following audio. Just output the transcription as raw text.';
            if (language && language !== 'auto') {
                systemPrompt = `Transcribe the following audio in ${language} language. Just output the transcription as raw text.`;
            }
            
            // Execute the transcription request
            // Create options for the AI provider
            interface AIProviderOptions {
                provider?: string | null;
                prompt: string;
                systemPrompt: string;
                files: Array<{
                    data: string;
                    type: string;
                    format: string;
                }>;
            }
            
            const executeOptions: AIProviderOptions = {
                provider: providerId || undefined, // Convert null to undefined if needed
                prompt: '',
                systemPrompt: systemPrompt,
                files: [
                    {
                        data: base64Audio,
                        type: 'audio/wav',
                        format: 'base64',
                    },
                ],
            };
            
            // Type assertion needed due to API compatibility issues
            // Need to use 'as any' here due to potential compatibility issues with AIExecuteOptions
            // This is a safer approach than creating an incomplete type implementation
            const response = await aiProviders.execute(executeOptions as any);
            
            // Handle the response from AI provider
            // The response is usually a AIStreamHandler which requires processing
            let transcriptionText = '';
            
            // Wait for the complete text via the stream handler
            if (typeof response === 'string') {
                // Direct string response
                transcriptionText = response;
            } else if (response) {
                // Stream handler response
                await new Promise<void>((resolve) => {
                    let fullText = '';
                    
                    // Set up stream handlers
                    if ('onData' in response && typeof response.onData === 'function') {
                        response.onData((text: string) => {
                            fullText += text;
                        });
                    }
                    
                    if ('onEnd' in response && typeof response.onEnd === 'function') {
                        response.onEnd((text: string) => {
                            fullText += text;
                            transcriptionText = fullText;
                            resolve();
                        });
                    } else {
                        // If no onEnd handler, resolve immediately
                        resolve();
                    }
                    
                    if ('onError' in response && typeof response.onError === 'function') {
                        response.onError((error: Error) => {
                            console.error('AI Provider transcription stream error:', error);
                            resolve(); // Resolve anyway to prevent hanging
                        });
                    }
                });
            }
            
            return {
                text: transcriptionText
            };
            
        } catch (error) {
            console.error('AI Provider transcription error:', error);
            throw new Error(`Failed to transcribe with AI Provider: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Detect the language of an audio file using the local Whisper ASR server
     * 
     * @param audioBlob The audio blob to analyze for language detection
     * @param fileExtension The file extension of the audio file
     * @returns An object with detected language code and name
     */
    private async detectLanguageWithLocalWhisper(audioBlob: Blob, fileExtension = 'wav'): Promise<{code: string, name: string}> {
        // Get the endpoint from settings
        const endpoint = this.plugin.settings.localWhisperEndpoint;
        if (!endpoint) {
            throw new Error('Local Whisper endpoint not configured');
        }
        
        try {
            // Ensure the server URL doesn't end with a slash
            const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
            
            // Convert the audio blob to ArrayBuffer for the request
            const audioBuffer = await audioBlob.arrayBuffer();
            
            // Map file extensions to MIME types
            const mimeTypeMap: Record<string, string> = {
                'webm': 'audio/webm',
                'mp3': 'audio/mpeg',
                'mp4': 'audio/mp4',
                'm4a': 'audio/mp4',
                'wav': 'audio/wav',
                'ogg': 'audio/ogg',
                'flac': 'audio/flac'
            };
            
            // Get the correct MIME type based on the file extension
            const mimeType = mimeTypeMap[fileExtension.toLowerCase()] || 'audio/wav';
            
            // Create the multipart/form-data request with a proper boundary
            const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
            
            // Create the multipart/form-data parts
            const encoder = new TextEncoder();
            const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="audio_file"; filename="recording.${fileExtension}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
            const fileFooter = `\r\n--${boundary}--\r\n`;
            
            // Convert parts to Uint8Array
            const headerArray = encoder.encode(fileHeader);
            const footerArray = encoder.encode(fileFooter);
            
            // Combine the header, audio data, and footer into a single ArrayBuffer
            const combinedLength = headerArray.length + audioBuffer.byteLength + footerArray.length;
            const combinedArray = new Uint8Array(combinedLength);
            combinedArray.set(headerArray, 0);
            combinedArray.set(new Uint8Array(audioBuffer), headerArray.length);
            combinedArray.set(footerArray, headerArray.length + audioBuffer.byteLength);
            
            // Send the request with the proper Content-Type header
            const response = await requestUrl({
                url: `${baseUrl}/detect-language`,
                method: 'POST',
                body: combinedArray.buffer,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                throw: false, // Don't throw on error, handle it manually
            });
            
            // Check for errors
            if (response.status !== 200) {
                console.error(`Language detection request failed, status ${response.status}:`, response.text);
                throw new Error(`Language detection request failed, status ${response.status}`);
            }
            
            // Parse the JSON response
            const result = response.json;
            console.log('Language detection result:', result);
            
            // Return both detected_language and language_code directly from the API
            // This avoids any need for mapping arrays
            if (result && typeof result === 'object') {
                const name = ('detected_language' in result && typeof result.detected_language === 'string') 
                    ? result.detected_language 
                    : 'English';
                const code = ('language_code' in result && typeof result.language_code === 'string') 
                    ? result.language_code 
                    : 'en';
                    
                return { code, name };
            }
            
            return { code: 'en', name: 'English' }; // Default if detection fails
        } catch (error) {
            console.error('Local Whisper language detection error:', error);
            // Return English as fallback if there's an error
            return { code: 'en', name: 'English' };
        }
    }
    
    /**
     * Transcribe audio using local Whisper ASR server
     * 
     * @param audioBlob The audio blob to transcribe
     * @param language Language code for transcription, or 'auto' for automatic detection
     * @param fileExtension The file extension of the audio file
     * @returns Transcription result
     */
    private async transcribeWithLocalWhisper(audioBlob: Blob, language: string, fileExtension = 'wav'): Promise<TranscriptionResult> {
        // Get the endpoint from settings
        const endpoint = this.plugin.settings.localWhisperEndpoint;
        if (!endpoint) {
            throw new Error('Local Whisper endpoint not configured');
        }
        
        // Ensure the server URL doesn't end with a slash
        const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        
        // First, detect language if set to auto
        let detectedLanguage: string | undefined;
        let languageCode: string | undefined;
        if (language === 'auto' && this.plugin.settings.transcriptionLanguage === 'auto') {
            new Notice('Voice AI Journal: Detecting audio language...');
            console.log('Language set to auto, performing language detection...');
            try {
                const languageInfo = await this.detectLanguageWithLocalWhisper(audioBlob, fileExtension);
                detectedLanguage = languageInfo.name;
                languageCode = languageInfo.code;
                console.log(`Detected language: ${detectedLanguage} (code: ${languageCode})`);
                
                // Log additional debug information
                console.log(`Using language code '${languageCode}' for transcription`);
            } catch (error) {
                console.warn('Language detection failed, proceeding without language specification:', error);
            }
        }
        
        try {
            // Convert the audio blob to ArrayBuffer for the request
            const audioBuffer = await audioBlob.arrayBuffer();
            
            // Map file extensions to MIME types
            const mimeTypeMap: Record<string, string> = {
                'webm': 'audio/webm',
                'mp3': 'audio/mpeg',
                'mp4': 'audio/mp4',
                'm4a': 'audio/mp4',
                'wav': 'audio/wav',
                'ogg': 'audio/ogg',
                'flac': 'audio/flac'
            };
            
            // Get the correct MIME type based on the file extension
            const mimeType = mimeTypeMap[fileExtension.toLowerCase()] || 'audio/wav';
            
            // Create the multipart/form-data request with a proper boundary
            const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
            
            // Create the multipart/form-data parts
            const encoder = new TextEncoder();
            const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="audio_file"; filename="recording.${fileExtension}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
            const fileFooter = `\r\n--${boundary}--\r\n`;
            
            // Convert parts to Uint8Array
            const headerArray = encoder.encode(fileHeader);
            const footerArray = encoder.encode(fileFooter);
            
            // Combine the header, audio data, and footer into a single ArrayBuffer
            const combinedLength = headerArray.length + audioBuffer.byteLength + footerArray.length;
            const combinedArray = new Uint8Array(combinedLength);
            combinedArray.set(headerArray, 0);
            combinedArray.set(new Uint8Array(audioBuffer), headerArray.length);
            combinedArray.set(footerArray, headerArray.length + audioBuffer.byteLength);
            
            // Prepare URL with parameters
            let url = `${baseUrl}/asr?output=json`;
            // We need to use the language code for the ASR API, not the full language name
            const languageToUse = languageCode || (language !== 'auto' ? language : undefined);
            
            // Add language parameter if we have a language code
            if (languageToUse) {
                // Log the URL we're constructing for debugging
                console.debug(`Adding language parameter: ${languageToUse}`);
                url += `&language=${encodeURIComponent(languageToUse)}`;
            }
            
            // Log the final URL for debugging
            console.debug(`Sending request to: ${url}`);
            
            // Add diarization parameter if enabled
            if (this.plugin.settings.automaticSpeechDetection) {
                url += '&diarize=true';
            }
            
            // Send the request with the proper Content-Type header
            new Notice('Voice AI Journal: Transcribing audio...');
            const response = await requestUrl({
                url: url,
                method: 'POST',
                body: combinedArray.buffer,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                throw: false, // Don't throw on error, handle it manually
            });
            
            // Check for errors
            if (response.status !== 200) {
                console.error(`Transcription request failed, status ${response.status}:`, response.text);
                throw new Error(`Transcription request failed, status ${response.status}`);
            }
            
            console.debug('[VoiceAIJournal] ASR server response status:', response.status);
            console.debug('[VoiceAIJournal] ASR server raw response:', response.text);
            
            // Parse the JSON response (fall back to manual parse if needed)
            interface WhisperResponse {
                text?: string;
                segments?: Array<{text: string}>;
            }
            
            let parsed: WhisperResponse;
            try {
                parsed = response.json ?? JSON.parse(response.text);
            } catch (err) {
                console.error('[VoiceAIJournal] Failed to parse ASR JSON response:', err, response.text);
                throw err;
            }
            
            // Get the transcription text
            let text = '';
            if (parsed.text) {
                text = parsed.text;
            } else if (Array.isArray(parsed.segments)) {
                text = parsed.segments.map(seg => seg.text).join(' ');
            }
            
            console.log('[VoiceAIJournal] ASR transcript:', text);
            
            return { 
                text: text,
                detectedLanguage: detectedLanguage,
                languageCode: languageCode
            };
        } catch (error) {
            console.error('Local Whisper transcription error:', error);
            throw new Error(`Failed to transcribe with Local Whisper: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Convert a Blob to a base64 string
     * @param blob The blob to convert
     * @returns A Promise that resolves to the base64 string
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('FileReader did not return a string'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
