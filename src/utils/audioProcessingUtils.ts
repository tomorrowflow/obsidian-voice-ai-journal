import { Notice, TFile } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';

/**
 * Extract tags from transcription text using LLM
 * 
 * @param plugin The VoiceAIJournalPlugin instance
 * @param transcription The transcription text
 * @returns Array of extracted tags
 */
export async function extractTags(
    plugin: VoiceAIJournalPlugin,
    transcription: string
): Promise<string[]> {
    try {
        // Get the AI provider for analysis
        const analysisProviderId = plugin.settings.aiProviders.analysis;
        
        if (!analysisProviderId) {
            console.warn('No analysis provider configured for tag extraction');
            return ['vaj']; // Return only the default tag
        }
        
        // Use the tag extraction prompt from settings
        const tagPrompt = plugin.settings.tagExtractionPrompt;
        
        // Get the LLM response for tag extraction
        const response = await plugin.aiManager.analyzeText(
            transcription,
            tagPrompt,
            analysisProviderId
        );
        
        if (!response) {
            console.warn('Tag extraction returned empty response');
            return ['vaj'];
        }
        
        try {
            // Parse the JSON response
            const parsedResponse = JSON.parse(response) as string[];
            
            // Ensure the result is an array of strings
            if (Array.isArray(parsedResponse)) {
                // Add the default 'vaj' tag
                if (!parsedResponse.includes('vaj')) {
                    parsedResponse.unshift('vaj');
                }
                
                // Add current date in YYYY-MM-DD format
                const today = new Date();
                const dateStr = today.toISOString().split('T')[0];
                if (!parsedResponse.includes(dateStr)) {
                    parsedResponse.push(dateStr);
                }
                
                return parsedResponse;
            }
        } catch (parseError) {
            console.error('Failed to parse tag extraction response:', parseError);
            console.log('Raw response:', response);
        }
        
        // Fallback if parsing fails
        return ['vaj'];
    } catch (error) {
        console.error('Error extracting tags:', error);
        return ['vaj']; // Return only the default tag on error
    }
}

/**
 * Process audio transcription using template sections
 * This is a shared utility used for both recorded and uploaded audio
 * 
 * @param plugin The VoiceAIJournalPlugin instance
 * @param transcription The transcription text
 * @param templateId ID of the template to use
 * @param audioFilePath Optional path of the original audio file
 * @param transcriptFilePath Optional path of the transcript file
 * @param detectedLanguage Optional detected language name
 * @param languageCode Optional detected language code
 * @returns Processed content for the journal entry
 */
export async function processTranscriptionWithTemplate(
    plugin: VoiceAIJournalPlugin,
    transcription: string,
    templateId: string,
    audioFilePath?: string,
    transcriptFilePath?: string,
    detectedLanguage?: string,
    languageCode?: string
): Promise<string> {
    try {
        // Get selected template
        const selectedTemplate = plugin.getTemplateById(templateId);
        if (!selectedTemplate) {
            throw new Error('Selected template not found');
        }
        
        // Initialize template variables with the transcription
        const templateVars: Record<string, string> = {
            transcription: transcription
        };
        
        // Get the AI provider for analysis
        const analysisProviderId = plugin.settings.aiProviders.analysis;
        
        // Extract tags from the transcription
        new Notice('Extracting tags from transcription...');
        const tags = await extractTags(plugin, transcription);
        console.log('Extracted tags:', tags);
        
        // Build frontmatter with tags and source files
        let frontmatter = '---\ntags:\n' + tags.map(tag => `  - ${tag}`).join('\n');
        
        // Add source files if available
        if (audioFilePath || transcriptFilePath) {
            frontmatter += '\nsource:';
            if (audioFilePath) {
                // Ensure quotes are properly formatted for YAML
                const cleanPath = audioFilePath.startsWith('/') ? audioFilePath.substring(1) : audioFilePath;
                frontmatter += `\n  - "[[${cleanPath}]]"`;
            }
            if (transcriptFilePath) {
                // Ensure quotes are properly formatted for YAML
                const cleanPath = transcriptFilePath.startsWith('/') ? transcriptFilePath.substring(1) : transcriptFilePath;
                frontmatter += `\n  - "[[${cleanPath}]]"`;
            }
        }
        
        frontmatter += '\n---\n\n';
        
        // Final journal content to be built section by section
        let journalContent = frontmatter;
        
        // Special token to indicate no results for optional sections
        const NO_RESULTS_TOKEN = "[[NO_RESULTS_FOR_OPTIONAL_SECTION]]";
        
        // Process each template section
        if (selectedTemplate.sections.length > 0) {
            console.log(`[DEBUG TEMPLATE] Processing template: ${selectedTemplate.name} with ${selectedTemplate.sections.length} sections`);
            
            // Iterate through each section in the template
            for (const section of selectedTemplate.sections) {
                console.log(`[DEBUG TEMPLATE] Processing section: ${section.title}, Optional: ${section.optional}`);
                // console.log(`[DEBUG TEMPLATE] Section prompt: ${section.prompt?.substring(0, 100)}...`);
                // console.log(`[DEBUG TEMPLATE] Section context: ${section.context?.substring(0, 100)}...`);
                
                // Skip optional sections that shouldn't be included
                if (section.optional && !plugin.settings.includeOptionalSections) {
                    console.log(`[DEBUG TEMPLATE] Skipping optional section: ${section.title} (disabled in settings)`);
                    continue;
                }
                
                // Process this section with the LLM if it has a prompt
                if (section.prompt && section.prompt.trim()) {
                    new Notice(`Processing section "${section.title}" with LLM...`);
                    
                    // Prepare the prompt - add special instructions for optional sections
                    let sectionPrompt = section.prompt;
                    if (section.optional) {
                        // Add instruction for optional sections to return special token if no valid content
                        sectionPrompt = `If you cannot provide a meaningful response to this optional section, respond ONLY with ${NO_RESULTS_TOKEN} and nothing else. DO NOT try to make up information if there is nothing relevant in the transcription.\n\n${sectionPrompt}`;
                    }
                    
                    // Log which template and section is about to be processed by the LLM
                    console.log(`[DEBUG LLM PROCESSING] About to process template "${selectedTemplate.name}" section "${section.title}" with LLM...`);
                    
                    // Get the LLM response for this section
                    const sectionResponse = await plugin.aiManager.analyzeText(
                        transcription, 
                        sectionPrompt, 
                        analysisProviderId,
                        detectedLanguage,
                        languageCode
                    );
                    
                    // For optional sections, check if we got the special token
                    if (section.optional && sectionResponse.trim() === NO_RESULTS_TOKEN) {
                        // Skip this section entirely if we got the no results token
                        console.log(`Skipping optional section "${section.title}" as LLM returned no results token`);
                        continue;
                    }
                    
                    // Add this response to template variables
                    templateVars[section.title.toLowerCase().replace(/\s+/g, '_')] = sectionResponse;
                    
                    // Add the raw response as 'response' for this section's context
                    templateVars['response'] = sectionResponse;
                    
                    // Process this section's context with the response
                    const sectionContent = plugin.templateManager.processTemplate(
                        section.context, 
                        templateVars
                    );
                    
                    // Add to the final journal content
                    journalContent += sectionContent;
                    
                    // Log final content that was added from this section
                    console.log(`[DEBUG TEMPLATE] Added content from section "${section.title}", length: ${sectionContent.length} chars`);
                }
                // If there's a context but no prompt, just process the context with existing variables
                else if (section.context && section.context.trim()) {
                    const sectionContent = plugin.templateManager.processTemplate(
                        section.context, 
                        templateVars
                    );
                    journalContent += sectionContent;
                    
                    // Log final content that was added from this context-only section
                    console.log(`[DEBUG TEMPLATE] Added content from context-only section "${section.title}", length: ${sectionContent.length} chars`);
                    console.log(`[DEBUG TEMPLATE] First 100 chars of context-only section: ${sectionContent.substring(0, 100)}...`);
                }
            }
        }
        
        // Fallback if template has no sections or processing fails
        if (!journalContent.trim()) {
            new Notice('Using default journal format as template processing failed or no sections found');
            journalContent = `# Journal Entry\n\n## Transcription\n${transcription}\n\n`;
        }
        
        // We don't need to add the audio file link here anymore as it's in the frontmatter
        // But we'll keep this for backward compatibility with older templates
        if (audioFilePath && !journalContent.includes(audioFilePath)) {
            journalContent += `\n[Original Audio](${audioFilePath})\n`;
        }
        
        // Log full journal content at the end
        console.log(`[DEBUG TEMPLATE] Final journal content length: ${journalContent.length} chars`);
        console.log(`[DEBUG TEMPLATE] Last 200 chars of journal content: ${journalContent.substring(Math.max(0, journalContent.length - 200))}`);
        
        return journalContent;
    } catch (error) {
        console.error('Error processing transcription with template:', error);
        throw error;
    }
}

/**
 * Create a journal entry from processed content
 * 
 * @param plugin The VoiceAIJournalPlugin instance
 * @param content The processed content
 * @param noteFilename The filename for the journal entry
 */
export async function createJournalEntry(
    plugin: VoiceAIJournalPlugin,
    content: string,
    noteFilename: string
): Promise<void> {
    try {
        // Full path for the note
        const notePath = `${plugin.settings.noteLocation}/${noteFilename}.md`.replace(/\/+/g, '/');
        
        // Ensure the directory exists
        const folderPath = notePath.substring(0, notePath.lastIndexOf('/'));
        if (folderPath) {
            const exists = await plugin.app.vault.adapter.exists(folderPath);
            if (!exists) {
                await plugin.app.vault.createFolder(folderPath);
            }
        }
        
        // Check if file exists and handle according to settings
        const fileExists = await plugin.app.vault.adapter.exists(notePath);
        
        if (fileExists && plugin.settings.appendToExistingNote) {
            // Append to existing file
            const existingContent = await plugin.app.vault.adapter.read(notePath);
            const newContent = `${existingContent}\n\n${content}`;
            await plugin.app.vault.adapter.write(notePath, newContent);
        } else {
            // Create new file
            await plugin.app.vault.create(notePath, content);
        }
        
        // Open the file
        const file = plugin.app.vault.getAbstractFileByPath(notePath);
        if (file && file instanceof TFile) {
            await plugin.app.workspace.getLeaf().openFile(file);
        }
        
        new Notice(`Journal entry created: ${noteFilename}`);
    } catch (error) {
        console.error('Error creating journal entry:', error);
        throw new Error(`Failed to create journal entry: ${error instanceof Error ? error.message : String(error)}`);
    }
}
