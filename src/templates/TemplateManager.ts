import { moment } from 'obsidian';
import type { JournalTemplate } from '../types';
import type { SemanticLinker } from '../semantic/SemanticLinker';

/**
 * Template manager to handle template processing and rendering
 */
export class TemplateManager {
    private semanticLinker?: SemanticLinker;

    constructor(semanticLinker?: SemanticLinker) {
        this.semanticLinker = semanticLinker;
    }
    /**
     * Process a template string by replacing placeholders with actual content
     * 
     * @param template The template string to process
     * @param variables The variables to inject into the template
     * @returns The processed template string
     */
    processTemplate(templateContent: string, variables: Record<string, string>): string {
        let result = templateContent;
        
        // Replace date variables (format: {{date:FORMAT}})
        result = this.processDateVariables(result);
        
        // Replace content variables
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        
        return result;
    }

    /**
     * Process date variables in the format {{date:FORMAT}}
     * Uses moment.js for date formatting
     * 
     * @param templateText The template text to process
     * @param date Optional custom date to use (defaults to current date)
     * @returns The template with date variables replaced
     */
    private processDateVariables(templateText: string, date?: Date): string {
        const dateRegex = /{{date:([^}]+)}}/g;
        let match;
        let result = templateText;
        
        while ((match = dateRegex.exec(templateText)) !== null) {
            const placeholder = match[0];
            const format = match[1];
            // Use the provided date or current date
            const momentDate = date ? moment(date) : moment();
            const formattedDate = momentDate.format(format);
            result = result.replace(placeholder, formattedDate);
        }
        
        return result;
    }

    /**
     * Generate a filename for the journal entry based on template
     * 
     * @param filenameTemplate Template string for filename (supports date variables)
     * @param date Optional custom date to use (defaults to current date)
     * @returns Processed filename
     */
    generateFilename(filenameTemplate: string, date?: Date): string {
        return this.processDateVariables(filenameTemplate, date);
    }

    /**
     * Validate a template format
     * 
     * @param template The template to validate
     * @returns true if valid, false otherwise
     */
    validateTemplate(templateContent: string): boolean {
        // Simple validation to check if the template contains required placeholders
        return templateContent.includes('{{transcription}}');
    }

    /**
     * Create a basic template with default structure
     * 
     * @param name The name of the template
     * @returns A new template object
     */
    createBasicTemplate(name: string): JournalTemplate {
        const id = 'template_' + Date.now();
        return {
            id,
            name,
            description: 'Custom template',
            sections: [
                {
                    title: 'Voice Note',
                    context: '{{transcription}}',
                    prompt: 'Transcribe the following audio.',
                    optional: false
                },
                {
                    title: 'Summary',
                    context: '{{summary}}',
                    prompt: 'Summarize the key points from this journal entry.',
                    optional: false
                }
            ]
        };
    }

    /**
     * Create a new template based on an existing one
     * 
     * @param sourceTemplate The source template to duplicate
     * @param newName The name for the new template
     * @returns A new template object
     */
    duplicateTemplate(sourceTemplate: JournalTemplate, newName: string): JournalTemplate {
        return {
            ...sourceTemplate,
            id: 'template_' + Date.now(),
            name: newName
        };
    }

    /**
     * Create an HTML preview of a rendered template
     * 
     * @param templateContent The template content to render
     * @returns An HTML element with the preview
     */
    createTemplatePreview(templateContent: string): HTMLElement {
        const previewEl = document.createElement('div');
        previewEl.addClass('voice-ai-journal-template-preview');
        
        // For demonstration, use sample variables
        const sampleVariables = {
            transcription: 'This is a sample transcription of your voice note.',
            summary: 'This is a sample summary of the journal entry.',
            insights: '- Key insight 1\n- Key insight 2\n- Key insight 3',
            gratitude_points: '- Grateful for family\n- Grateful for health\n- Grateful for opportunities',
            positive_moments: '- Had a productive meeting\n- Enjoyed a nice walk\n- Connected with an old friend'
        };
        
        const processedTemplate = this.processTemplate(templateContent, sampleVariables);
        previewEl.innerHTML = `<div class="voice-ai-journal-preview-content">${processedTemplate}</div>`;
        
        return previewEl;
    }

    /**
     * Process semantic variables in templates (e.g., {{related_notes}}, {{semantic_links}})
     *
     * @param templateContent The template content to process
     * @param journalContent The journal content to find related notes for
     * @param maxResults Maximum number of related notes to include
     * @returns The template with semantic variables replaced
     */
    async processSemanticVariables(
        templateContent: string,
        journalContent: string,
        maxResults: number = 5
    ): Promise<string> {
        if (!this.semanticLinker) {
            // If no semantic linker available, replace semantic variables with empty strings
            return templateContent
                .replace(/{{related_notes}}/g, '')
                .replace(/{{semantic_links}}/g, '')
                .replace(/{{similar_entries}}/g, '');
        }

        let result = templateContent;

        // Process {{related_notes}} variable
        if (result.includes('{{related_notes}}')) {
            const relatedNotes = await this.getRelatedNotes(journalContent, maxResults);
            result = result.replace(/{{related_notes}}/g, relatedNotes);
        }

        // Process {{semantic_links}} variable
        if (result.includes('{{semantic_links}}')) {
            const semanticLinks = await this.getSemanticLinks(journalContent, maxResults);
            result = result.replace(/{{semantic_links}}/g, semanticLinks);
        }

        // Process {{similar_entries}} variable
        if (result.includes('{{similar_entries}}')) {
            const similarEntries = await this.getSimilarEntries(journalContent, maxResults);
            result = result.replace(/{{similar_entries}}/g, similarEntries);
        }

        return result;
    }

    /**
     * Get related notes based on semantic similarity
     *
     * @param content The content to find related notes for
     * @param maxResults Maximum number of results to return
     * @returns Formatted string of related notes
     */
    private async getRelatedNotes(content: string, maxResults: number): Promise<string> {
        if (!this.semanticLinker) {
            return '';
        }

        try {
            const results = await this.semanticLinker.findRelatedNotes(content, maxResults);
            
            if (results.length === 0) {
                return 'No related notes found.';
            }

            return results
                .map((result: any) => {
                    const fileName = result.filePath.split('/').pop()?.replace('.md', '') || 'Unknown';
                    return `- [[${fileName}]] (similarity: ${(result.similarity * 100).toFixed(1)}%)`;
                })
                .join('\n');
        } catch (error) {
            console.error('Error getting related notes:', error);
            return 'Error retrieving related notes.';
        }
    }

    /**
     * Get semantic links formatted as markdown links
     *
     * @param content The content to find semantic links for
     * @param maxResults Maximum number of results to return
     * @returns Formatted string of semantic links
     */
    private async getSemanticLinks(content: string, maxResults: number): Promise<string> {
        if (!this.semanticLinker) {
            return '';
        }

        try {
            const results = await this.semanticLinker.findRelatedNotes(content, maxResults);
            
            if (results.length === 0) {
                return 'No semantic links found.';
            }

            return results
                .map((result: any) => {
                    const fileName = result.filePath.split('/').pop()?.replace('.md', '') || 'Unknown';
                    return `[[${fileName}]]`;
                })
                .join(' • ');
        } catch (error) {
            console.error('Error getting semantic links:', error);
            return 'Error retrieving semantic links.';
        }
    }

    /**
     * Get similar entries with excerpts
     *
     * @param content The content to find similar entries for
     * @param maxResults Maximum number of results to return
     * @returns Formatted string of similar entries with excerpts
     */
    private async getSimilarEntries(content: string, maxResults: number): Promise<string> {
        if (!this.semanticLinker) {
            return '';
        }

        try {
            const results = await this.semanticLinker.findRelatedNotes(content, maxResults);
            
            if (results.length === 0) {
                return 'No similar entries found.';
            }

            return results
                .map((result: any) => {
                    const fileName = result.filePath.split('/').pop()?.replace('.md', '') || 'Unknown';
                    const excerpt = result.excerpt ? result.excerpt.substring(0, 100) + '...' : 'No excerpt available';
                    return `**[[${fileName}]]** (${(result.similarity * 100).toFixed(1)}% similar)\n> ${excerpt}`;
                })
                .join('\n\n');
        } catch (error) {
            console.error('Error getting similar entries:', error);
            return 'Error retrieving similar entries.';
        }
    }

    /**
     * Enhanced template processing that includes semantic variables
     *
     * @param templateContent The template string to process
     * @param variables The variables to inject into the template
     * @param journalContent Optional journal content for semantic processing
     * @param maxSemanticResults Maximum number of semantic results to include
     * @returns The processed template string
     */
    async processTemplateWithSemantics(
        templateContent: string,
        variables: Record<string, string>,
        journalContent?: string,
        maxSemanticResults: number = 5
    ): Promise<string> {
        let result = templateContent;
        
        // First process semantic variables if journal content is provided
        if (journalContent) {
            result = await this.processSemanticVariables(result, journalContent, maxSemanticResults);
        }
        
        // Then process regular template variables
        result = this.processTemplate(result, variables);
        
        return result;
    }

    /**
     * Set the semantic linker instance
     *
     * @param semanticLinker The semantic linker to use for semantic processing
     */
    setSemanticLinker(semanticLinker: SemanticLinker): void {
        this.semanticLinker = semanticLinker;
    }

    /**
     * Check if semantic processing is available
     *
     * @returns True if semantic linker is available, false otherwise
     */
    isSemanticProcessingAvailable(): boolean {
        return !!this.semanticLinker;
    }
}
