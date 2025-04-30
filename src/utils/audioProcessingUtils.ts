import { Notice, TFile } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';

/**
 * Process audio transcription using template sections
 * This is a shared utility used for both recorded and uploaded audio
 * 
 * @param plugin The VoiceAIJournalPlugin instance
 * @param transcription The transcription text
 * @param templateId ID of the template to use
 * @param audioFileName Optional filename of the original audio file
 * @returns Processed content for the journal entry
 */
export async function processTranscriptionWithTemplate(
    plugin: VoiceAIJournalPlugin,
    transcription: string,
    templateId: string,
    audioFileName?: string,
    detectedLanguage?: string
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
        
        // Final journal content to be built section by section
        let journalContent = '';
        
        // Process each template section
        if (selectedTemplate.sections.length > 0) {
            // Iterate through each section in the template
            for (const section of selectedTemplate.sections) {
                // Skip optional sections that shouldn't be included
                if (section.optional && !plugin.settings.includeOptionalSections) {
                    continue;
                }
                
                // Process this section with the LLM if it has a prompt
                if (section.prompt && section.prompt.trim()) {
                    new Notice(`Processing section "${section.title}" with LLM...`);
                    
                    // Get the LLM response for this section
                    const sectionResponse = await plugin.aiManager.analyzeText(
                        transcription, 
                        section.prompt, 
                        analysisProviderId,
                        detectedLanguage
                    );
                    
                    // Add this response to template variables
                    templateVars[section.title.toLowerCase().replace(/\\s+/g, '_')] = sectionResponse;
                    
                    // Add the raw response as 'response' for this section's context
                    templateVars['response'] = sectionResponse;
                    
                    // Process this section's context with the response
                    const sectionContent = plugin.templateManager.processTemplate(
                        section.context, 
                        templateVars
                    );
                    
                    // Add to the final journal content
                    journalContent += sectionContent;
                }
                // If there's a context but no prompt, just process the context with existing variables
                else if (section.context && section.context.trim()) {
                    const sectionContent = plugin.templateManager.processTemplate(
                        section.context, 
                        templateVars
                    );
                    journalContent += sectionContent;
                }
            }
        }
        
        // Fallback if template has no sections or processing fails
        if (!journalContent.trim()) {
            new Notice('Using default journal format as template processing failed or no sections found');
            journalContent = `# Journal Entry\n\n## Transcription\n${transcription}\n\n`;
        }
        
        // Add link to audio file if provided
        if (audioFileName) {
            journalContent += `\n[Original Audio](${audioFileName})\n`;
        }
        
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
