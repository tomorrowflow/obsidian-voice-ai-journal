import { App, Modal, Setting } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';
import type { JournalTemplate } from '../types';
import { TemplateManager } from '../templates/TemplateManager';

/**
 * Modal for editing journal templates
 */
export class TemplateEditorModal extends Modal {
    private plugin: VoiceAIJournalPlugin;
    private templateManager: TemplateManager;
    private template: JournalTemplate;
    private isNewTemplate: boolean;
    private saveCallback: (template: JournalTemplate) => void;

    constructor(
        app: App, 
        plugin: VoiceAIJournalPlugin, 
        template?: JournalTemplate,
        saveCallback?: (template: JournalTemplate) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.templateManager = new TemplateManager();
        
        // Determine if this is a new template or editing existing
        this.isNewTemplate = !template;
        
        // Create a new template or clone the existing one
        if (this.isNewTemplate) {
            this.template = this.templateManager.createBasicTemplate('New Template');
        } else {
            // Clone to avoid modifying the original until save
            this.template = JSON.parse(JSON.stringify(template));
        }
        
        // Save callback
        this.saveCallback = saveCallback || ((template: JournalTemplate) => {
            if (this.isNewTemplate) {
                this.plugin.addTemplate(template);
            } else {
                this.plugin.updateTemplate(template.id, template);
            }
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Set modal title
        contentEl.createEl('h2', { text: this.isNewTemplate ? 'Create Template' : 'Edit Template' });
        
        // Basic template info
        new Setting(contentEl)
            .setName('Template Name')
            .setDesc('A name to identify this template')
            .addText(text => text
                .setValue(this.template.name)
                .onChange(value => {
                    this.template.name = value;
                })
            );
        
        new Setting(contentEl)
            .setName('Description')
            .setDesc('Describe what this template is for')
            .addText(text => text
                .setValue(this.template.description)
                .onChange(value => {
                    this.template.description = value;
                })
            );
        
        // Template content
        contentEl.createEl('h3', { text: 'Template Content' });
        
        const templateHelpText = contentEl.createEl('p', { 
            text: 'Use placeholders like {{transcription}}, {{summary}}, {{insights}} etc. You can also use date formatting with {{date:YYYY-MM-DD}}.' 
        });
        templateHelpText.addClass('template-help-text');
        
        const templateContainer = contentEl.createDiv('template-editor-container');
        
        const templateTextarea = document.createElement('textarea');
        templateTextarea.addClass('template-editor-textarea');
        templateTextarea.value = this.template.sections[0]?.context;
        templateTextarea.rows = 10;
        templateTextarea.addEventListener('change', () => {
            if (this.template.sections.length > 0) {
                this.template.sections[0].context = templateTextarea.value;
            }
            this.updatePreview();
        });
        
        templateContainer.appendChild(templateTextarea);
        
        // AI Prompt
        contentEl.createEl('h3', { text: 'AI Analysis Prompt' });
        
        const promptHelpText = contentEl.createEl('p', { 
            text: 'This prompt will be sent to the AI along with the transcription to generate analysis.' 
        });
        promptHelpText.addClass('prompt-help-text');
        
        const promptTextarea = document.createElement('textarea');
        promptTextarea.addClass('prompt-editor-textarea');
        promptTextarea.value = this.template.sections[0]?.prompt;
        promptTextarea.rows = 4;
        promptTextarea.addEventListener('change', () => {
            if (this.template.sections.length > 0) {
                this.template.sections[0].prompt = promptTextarea.value;
            }
        });
        
        contentEl.appendChild(promptTextarea);
        
        // Preview section
        contentEl.createEl('h3', { text: 'Preview' });
        
        const previewContainer = contentEl.createDiv('template-preview-container');
        previewContainer.id = 'template-preview';
        
        // Initial preview update
        this.updatePreview();
        
        // Buttons
        const buttonContainer = contentEl.createDiv('template-editor-buttons');
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.close();
        });
        
        const saveButton = buttonContainer.createEl('button', { text: 'Save' });
        saveButton.addClass('mod-cta');
        saveButton.addEventListener('click', () => {
            this.saveTemplate();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Update the template preview
     */
    private updatePreview() {
        const previewContainer = document.getElementById('template-preview');
        if (!previewContainer) return;
        
        previewContainer.empty();
        
        try {
            const previewEl = this.templateManager.createTemplatePreview(this.template.sections[0]?.context);
            previewContainer.appendChild(previewEl);
        } catch (error) {
            const errorEl = document.createElement('div');
            errorEl.addClass('template-preview-error');
            errorEl.setText(`Preview error: ${error instanceof Error ? error.message : String(error)}`);
            previewContainer.appendChild(errorEl);
        }
    }

    /**
     * Validate and save the template
     */
    private saveTemplate() {
        // Validate template
        if (!this.template.name || this.template.name.trim() === '') {
            // Show error
            const notice = document.createElement('div');
            notice.addClass('notice');
            notice.setText('Template name is required');
            document.body.appendChild(notice);
            setTimeout(() => {
                notice.remove();
            }, 3000);
            return;
        }
        
        if (!this.templateManager.validateTemplate(this.template.sections[0]?.context)) {
            // Show error
            const notice = document.createElement('div');
            notice.addClass('notice');
            notice.setText('Template must include {{transcription}} placeholder');
            document.body.appendChild(notice);
            setTimeout(() => {
                notice.remove();
            }, 3000);
            return;
        }
        
        // Save the template
        this.saveCallback(this.template);
        this.close();
    }
}

/**
 * Modal for template management (listing, creating, editing, deleting)
 */
export class TemplateManagerModal extends Modal {
    private plugin: VoiceAIJournalPlugin;
    private templateManager: TemplateManager;

    constructor(app: App, plugin: VoiceAIJournalPlugin) {
        super(app);
        this.plugin = plugin;
        this.templateManager = new TemplateManager();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Set modal title
        contentEl.createEl('h2', { text: 'Template Manager' });
        
        // Description
        contentEl.createEl('p', { 
            text: 'Create and manage templates for your voice journal entries.' 
        });
        
        // List of templates
        const templateListContainer = contentEl.createDiv('voice-ai-journal-template-list');
        this.renderTemplateList(templateListContainer);
        
        // Add new template button
        const addButton = contentEl.createEl('button', { text: 'Add New Template' });
        addButton.addClass('mod-cta');
        addButton.addEventListener('click', () => {
            const modal = new TemplateEditorModal(this.app, this.plugin, undefined, (template) => {
                this.plugin.addTemplate(template);
                this.renderTemplateList(templateListContainer);
            });
            modal.open();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Render the list of templates
     */
    private renderTemplateList(container: HTMLElement) {
        container.empty();
        
        const templates = this.plugin.settings.templates;
        const defaultTemplateId = this.plugin.settings.defaultTemplate;
        
        if (templates.length === 0) {
            container.createEl('p', { text: 'No templates found. Create your first template!' });
            return;
        }
        
        templates.forEach(template => {
            const templateItem = container.createDiv('voice-ai-journal-template-item');
            
            // Template info
            const templateName = templateItem.createDiv('voice-ai-journal-template-name');
            templateName.setText(template.name);
            
            if (template.id === defaultTemplateId) {
                const defaultBadge = templateName.createSpan('default-badge');
                defaultBadge.setText('Default');
            }
            
            const templateDesc = templateItem.createDiv('voice-ai-journal-template-description');
            templateDesc.setText(template.description);
            
            // Template actions
            const actionsContainer = templateItem.createDiv('voice-ai-journal-template-actions');
            
            // Edit button
            const editButton = actionsContainer.createEl('button', { text: 'Edit' });
            editButton.addEventListener('click', () => {
                const modal = new TemplateEditorModal(this.app, this.plugin, template, (updatedTemplate) => {
                    this.plugin.updateTemplate(template.id, updatedTemplate);
                    this.renderTemplateList(container);
                });
                modal.open();
            });
            
            // Set as default button
            if (template.id !== defaultTemplateId) {
                const setDefaultButton = actionsContainer.createEl('button', { text: 'Set as Default' });
                setDefaultButton.addEventListener('click', () => {
                    this.plugin.settings.defaultTemplate = template.id;
                    this.plugin.saveSettings();
                    this.renderTemplateList(container);
                });
            }
            
            // Duplicate button
            const duplicateButton = actionsContainer.createEl('button', { text: 'Duplicate' });
            duplicateButton.addEventListener('click', () => {
                const newTemplate = this.templateManager.duplicateTemplate(template, `${template.name} (Copy)`);
                this.plugin.addTemplate(newTemplate);
                this.renderTemplateList(container);
            });
            
            // Delete button (only if not the last template)
            if (templates.length > 1) {
                const deleteButton = actionsContainer.createEl('button', { text: 'Delete' });
                deleteButton.addClass('delete-button');
                deleteButton.addEventListener('click', () => {
                    const confirmed = confirm(`Are you sure you want to delete the template "${template.name}"?`);
                    if (confirmed) {
                        this.plugin.deleteTemplate(template.id);
                        this.renderTemplateList(container);
                    }
                });
            }
        });
    }
}
