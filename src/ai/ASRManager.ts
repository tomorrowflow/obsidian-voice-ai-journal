import { TFile, Notice, requestUrl } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';
import { startTimer } from '../utils/timerUtils';

/**
 * Result of a transcription operation
 */
export interface TranscriptionResult {
    text: string;
    detectedLanguage?: string; // Full language name (e.g., 'English', 'German')
    languageCode?: string; // ISO language code (e.g., 'en', 'de')
    processingTimeMs?: number; // Processing time in milliseconds
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
        // Start the ASR timer
        const asrTimer = startTimer('ASR Transcription');
        
        try {
            // Select the transcription method based on the settings
            let result: TranscriptionResult;
            if (this.plugin.settings.transcriptionProvider === 'localWhisper') {
                result = await this.transcribeWithLocalWhisper(audioBlob, language, fileExtension);
            } else {
                result = await this.transcribeWithAIProviders(audioBlob, language);
            }
            
            // Log and notify about the ASR processing time
            const elapsedTime = asrTimer.stop();
            console.log(`ASR processing completed in ${asrTimer.getFormattedTime()}`);
            new Notice(`Audio transcribed in ${asrTimer.getFormattedTime()}`);
            
            // Add processing time to the result
            return {
                ...result,
                processingTimeMs: elapsedTime
            };
        } catch (error) {
            console.error(`ASR processing failed after ${asrTimer.getFormattedTime()}:`, error);
            throw error;
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
        // Start a timer for AI Provider transcription
        const aiProviderTimer = startTimer('AI Provider Transcription');
        
        const aiProviders = this.plugin.aiProviders;
        if (!aiProviders) {
            throw new Error('AI Providers not initialized');
        }
        
        try {
            // Convert audio to base64
            const base64Audio = await this.blobToBase64(audioBlob);
            
            // Get provider ID from settings or use default
            const providerId = this.plugin.settings.aiProviders?.transcription;
            
            // Find the provider object by ID
            const provider = aiProviders.providers.find(p => p.id === providerId);
            if (!provider) {
                throw new Error(`AI Provider with ID ${providerId} not found`);
            }
            
            // Build prompt with language instructions if needed
            let systemPrompt = 'Transcribe the following audio. Just output the transcription as raw text.';
            if (language && language !== 'auto') {
                systemPrompt += ` The audio is in ${language} language.`;
            }
            
            // Create options for the AI provider
            const options = {
                provider: provider,
                prompt: 'Transcribe this audio file.',
                systemPrompt: systemPrompt,
                files: [{
                    data: base64Audio,
                    type: 'audio',
                    format: 'base64'
                }]
            };
            
            // Execute the transcription request
            const streamHandler = await aiProviders.execute(options);
            
            // Get the full response text
            let response = '';
            await new Promise<string>((resolve, reject) => {
                streamHandler.onEnd((fullText) => {
                    response = fullText;
                    resolve(fullText);
                });
                streamHandler.onError((error) => {
                    reject(error);
                });
            });
            
            // Log the time taken for AI Provider transcription
            console.log(`AI Provider transcription completed in ${aiProviderTimer.getFormattedTime()}`);
            
            return {
                text: response,
                detectedLanguage: undefined,
                languageCode: language !== 'auto' ? language : undefined,
                processingTimeMs: aiProviderTimer.getElapsedTime()
            };
        } catch (error) {
            console.error(`AI Provider transcription failed after ${aiProviderTimer.getFormattedTime()}:`, error);
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
        
        // Normalize the endpoint URL
        const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        
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
            
            // Prepare URL with parameters for language detection
            const url = `${baseUrl}/detect-language?output=json`;
            
            // Send the request with the proper Content-Type header
            new Notice('Voice AI Journal: Detecting language...');
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
                console.error(`Language detection request failed, status ${response.status}:`, response.text);
                throw new Error(`Language detection request failed, status ${response.status}`);
            }
            
            // Enhanced logging for debugging
            console.log('[VoiceAIJournal] Language detection response status:', response.status);
            console.log('[VoiceAIJournal] Language detection raw response:', response.text);
            console.log('[VoiceAIJournal] Language detection response type:', typeof response.text);
            
            // Parse the JSON response
            let parsed;
            try {
                parsed = response.json ?? JSON.parse(response.text);
                console.log('[VoiceAIJournal] Parsed language detection response:', parsed);
            } catch (parseError) {
                console.error('[VoiceAIJournal] Failed to parse language detection response:', parseError);
                console.log('[VoiceAIJournal] Raw response that failed to parse:', response.text);
                // Default to English if parsing fails
                parsed = { language_code: 'en', language_name: 'english' };
            }
            
            // Get the language code and name
            // Check for both new API format (language_code) and old API format (detected_language)
            const languageCode = parsed.language_code || 
                                (parsed.detected_language_code || 'en');
            const languageName = parsed.language_name || 
                                (parsed.detected_language || 'english');
            
            console.log(`[VoiceAIJournal] Detected language: ${languageName} (${languageCode})`);
            
            return {
                code: languageCode,
                name: languageName
            };
        } catch (error) {
            console.error('Language detection error:', error);
            throw new Error(`Failed to detect language: ${error instanceof Error ? error.message : String(error)}`);
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
        // Start a timer for the Whisper transcription
        const whisperTimer = startTimer('Whisper Transcription');
        
        // Get the endpoint from settings
        const endpoint = this.plugin.settings.localWhisperEndpoint;
        if (!endpoint) {
            throw new Error('Local Whisper endpoint not configured');
        }
        
        // Normalize the endpoint URL
        const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        
        // Variables for language detection
        let detectedLanguage: string | undefined;
        let languageCode: string | undefined;
        
        // If language is set to 'auto', try to detect the language first
        if (language === 'auto') {
            try {
                console.log('[VoiceAIJournal] Starting language detection...');
                const langDetection = await this.detectLanguageWithLocalWhisper(audioBlob, fileExtension);
                detectedLanguage = langDetection.name;
                languageCode = langDetection.code;
                console.log(`[VoiceAIJournal] Using detected language: ${detectedLanguage} (${languageCode})`);
                
                // Add a notification for the user about the detected language
                new Notice(`Detected language: ${detectedLanguage}`);
            } catch (error) {
                console.warn('[VoiceAIJournal] Language detection failed, proceeding without language specification:', error);
                new Notice('Language detection failed, using default language');
            }
        } else {
            console.log(`[VoiceAIJournal] Using specified language: ${language}`);
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
                console.log(`[VoiceAIJournal] Adding language parameter: ${languageToUse}`);
                url += `&language=${encodeURIComponent(languageToUse)}`;
            } else {
                console.log('[VoiceAIJournal] No language parameter added, using server default');
            }
            
            // Log the final URL for debugging
            console.log(`[VoiceAIJournal] Sending transcription request to: ${url}`);
            
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
            
            // Log the transcript and language information
            console.log('[VoiceAIJournal] ASR transcript:', text);
            console.log(`[VoiceAIJournal] Detected language: ${detectedLanguage || 'not detected'} (${languageCode || 'unknown code'})`);
            
            // Log the time taken for Whisper transcription
            const transcriptionTime = whisperTimer.getFormattedTime();
            console.log(`[VoiceAIJournal] Whisper transcription completed in ${transcriptionTime}`);
            
            // Show a notification with the transcription time and language
            new Notice(`Transcription completed in ${transcriptionTime}${detectedLanguage ? ` (${detectedLanguage})` : ''}`);
            
            return { 
                text: text,
                detectedLanguage: detectedLanguage,
                languageCode: languageCode,
                processingTimeMs: whisperTimer.getElapsedTime()
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
