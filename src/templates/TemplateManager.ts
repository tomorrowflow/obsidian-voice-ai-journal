import { moment } from 'obsidian';
import type { JournalTemplate } from '../types';

/**
 * Template manager to handle template processing and rendering
 */
export class TemplateManager {
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
     * @returns The template with date variables replaced
     */
    private processDateVariables(templateText: string): string {
        const dateRegex = /{{date:([^}]+)}}/g;
        let match;
        let result = templateText;
        
        while ((match = dateRegex.exec(templateText)) !== null) {
            const placeholder = match[0];
            const format = match[1];
            const formattedDate = moment().format(format);
            result = result.replace(placeholder, formattedDate);
        }
        
        return result;
    }

    /**
     * Generate a filename for the journal entry based on template
     * 
     * @param filenameTemplate Template string for filename (supports date variables)
     * @returns Processed filename
     */
    generateFilename(filenameTemplate: string): string {
        return this.processDateVariables(filenameTemplate);
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
                    content: '{{transcription}}',
                    prompt: 'Transcribe the following audio.'
                },
                {
                    title: 'Summary',
                    content: '{{summary}}',
                    prompt: 'Summarize the key points from this journal entry.'
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
}
