import { App, Setting, Modal, Notice } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';
import type { JournalTemplate } from '../types';
import { DEFAULT_JOURNAL_TEMPLATE } from './settings';

/**
 * Interface for file structure representation
 */
interface FileStructure {
    path: string;
    children?: FileStructure[];
}

/**
 * Handles rendering and management of the Templates settings tab
 */
export class TemplateSettingsTab {
    private app: App;
    private plugin: VoiceAIJournalPlugin;
    private container: HTMLElement;
    private selectedTemplateId: string | null = null;

    constructor(app: App, plugin: VoiceAIJournalPlugin, containerEl: HTMLElement) {
        this.app = app;
        this.plugin = plugin;
        this.container = containerEl;
        this.render();
    }

    /**
     * Render the Templates tab UI. All template-related settings and controls
     * have been moved here from SettingsTab.
     */
    private render(): void {
        const containerEl = this.container;
        containerEl.empty();
        containerEl.createEl('h3', { text: 'Journal Templates' });

        // Ensure templates array exists and include default
        if (!Array.isArray(this.plugin.settings.templates)) {
            this.plugin.settings.templates = [];
        }
        let templates = [...this.plugin.settings.templates];
        if (!this.plugin.settings.templates.some(t => t.id === DEFAULT_JOURNAL_TEMPLATE.id)) {
            const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_JOURNAL_TEMPLATE));
            this.plugin.settings.templates.unshift(defaultCopy);
            templates = [defaultCopy, ...templates];
            this.plugin.saveSettings().catch(e => console.error('Failed to save default template', e));
        }

        // IDs and names for dropdowns
        const templateIds = templates.map(t => t.id);
        const templateNames = templates.map(t => t.name);

        // Set selectedTemplateId
        if (!this.selectedTemplateId || !templateIds.includes(this.selectedTemplateId)) {
            this.selectedTemplateId = templateIds.length > 0 ? templateIds[0] : null;
        }

        // Default Template selector
        new Setting(containerEl)
            .setName('LLM Template')
            .setDesc('Template used by llm to generate the journal entry')
            .addDropdown(dd => {
                if (templates.length === 0) dd.addOption('', 'No templates available');
                else templateIds.forEach((id,i) => dd.addOption(id, templateNames[i]));
                dd.setValue(this.plugin.settings.defaultTemplate || '');
                dd.onChange(async value => {
                    this.plugin.settings.defaultTemplate = value;
                    await this.plugin.saveSettings();
                });
            });

        containerEl.createEl('h3', { text: 'Template Management' });

        // Create & Clone Buttons
        const btnContainer = containerEl.createEl('div', { cls: 'voice-journal-new-template' });
        new Setting(btnContainer)
            .setName('Create New Template')
            .setDesc('Add a new journal template')
            .addButton(b => b.setButtonText('Add Template').setCta().onClick(async () => {
                const newT = { id: `template-${Date.now()}`, name: 'New Template', description: '', sections: [] } as JournalTemplate;
                await this.plugin.addTemplate(newT);
                this.selectedTemplateId = newT.id;
                this.render();
            }))
            .addButton(b => b.setButtonText('Clone Template').onClick(async () => {
                const src = templates.find(t => t.id === this.plugin.settings.defaultTemplate);
                if (src) {
                    const clone = { 
                        ...src, 
                        id: `template-${Date.now()}`, 
                        name: `${src.name} (clone)`,
                        sections: JSON.parse(JSON.stringify(src.sections)) 
                    } as JournalTemplate;
                    await this.plugin.addTemplate(clone);
                    this.selectedTemplateId = clone.id;
                    this.render();
                } else new Notice('Select a template to clone from the Default Template dropdown');
            }));

        // Edit selector
        if (templates.length > 0) {
            new Setting(containerEl)
                .setName('Edit Template')
                .setDesc('Select a template to edit')
                .addDropdown(dd => {
                    templateIds.forEach((id,i) => dd.addOption(id, templateNames[i]));
                    dd.setValue(this.selectedTemplateId || '');
                    dd.onChange(v => { this.selectedTemplateId = v; this.render(); });
                });
        } else {
            containerEl.createEl('p', { text: 'No templates found. Create one above.' });
        }

        // Editor
        if (this.selectedTemplateId) {
            const tmpl = templates.find(t => t.id === this.selectedTemplateId);
            if (tmpl) {
                const editEl = containerEl.createEl('div', { cls: 'voice-journal-template-editor' });
                // Name
                new Setting(editEl)
                    .setName('Template Name')
                    .setClass('template-name-setting')
                    .then(st => { st.nameEl.style.fontWeight='bold'; st.nameEl.style.fontSize='var(--h4-size)'; })
                    .addText(txt => { txt.setValue(tmpl.name).onChange(async v=>{ tmpl.name=v; await this.plugin.saveSettings(); }); txt.inputEl.style.width='100%'; });
                // Add Section
                new Setting(editEl)
                    .setName('Add Section')
                    .addButton(b=>b.setButtonText('Add Section').setCta().onClick(async ()=>{
                        tmpl.sections = tmpl.sections||[];
                        tmpl.sections.push({ title:'New Section', context:'', prompt:'', optional:false });
                        await this.plugin.saveSettings();
                        this.render();
                    }));
                // Sections
                tmpl.sections?.forEach((sec,idx)=>{
                    const sEl = editEl.createEl('div',{cls:'voice-journal-template-section'});
                    sEl.style.borderBottom='1px solid var(--background-modifier-border)'; sEl.style.marginBottom='1.5em'; sEl.style.paddingBottom='1em';
                    // Title
                    new Setting(sEl)
                        .setName('Section Title')
                        .setClass('section-title-setting')
                        .then(st=>st.nameEl.style.fontWeight='bold')
                        .addText(txt=>{ txt.setValue(sec.title||`Section ${idx+1}`).onChange(async v=>{ sec.title=v; await this.plugin.saveSettings(); }); txt.inputEl.style.width='100%'; txt.inputEl.addEventListener('blur',()=>this.render()); });
                    // Note Context
                    new Setting(sEl)
                        .setName('Note Context')
                        .addTextArea(ta=>{
                            ta.setValue(sec.context||'');
                            ta.inputEl.rows=4;
                            ta.inputEl.style.resize='none';
                            ta.inputEl.style.width='100%';
                            ta.onChange(async (v: string) => { sec.context = v; await this.plugin.saveSettings(); });
                        });
                    // Prompt
                    new Setting(sEl)
                        .setName('Prompt')
                        .addTextArea(ta=>{
                            ta.setValue(sec.prompt||'');
                            ta.inputEl.rows=4;
                            ta.inputEl.style.resize='none';
                            ta.inputEl.style.width='100%';
                            ta.onChange(async (v: string) => { sec.prompt = v; await this.plugin.saveSettings(); });
                        });
                    // Optional
                    new Setting(sEl)
                        .setName('Optional Section')
                        .addToggle(tg=>tg.setValue(sec.optional||false).onChange(async v=>{ sec.optional=v; await this.plugin.saveSettings(); }));
                });
                // Section removal UI
                if (tmpl.sections.length > 1) {
                    const removalContainer = editEl.createEl('div', { cls: 'section-removal-container' });
                    const removalSetting = new Setting(removalContainer)
                        .setName('Remove Section')
                        .setDesc('Select and remove a section from this template');
                    let selectedSectionIndex = 0;
                    removalSetting.addDropdown(dropdown => {
                        tmpl.sections.forEach((section, idx) => {
                            dropdown.addOption(idx.toString(), section.title || `Section ${idx + 1}`);
                        });
                        dropdown.setValue(selectedSectionIndex.toString());
                        dropdown.onChange(value => {
                            selectedSectionIndex = parseInt(value);
                        });
                    });
                    removalSetting.addButton(button => {
                        button.setButtonText('Remove')
                            .setWarning()
                            .onClick(async () => {
                                if (selectedSectionIndex >= 0 && selectedSectionIndex < tmpl.sections.length) {
                                    tmpl.sections.splice(selectedSectionIndex, 1);
                                    await this.plugin.saveSettings();
                                    this.render();
                                }
                            });
                    });
                }
                // Remove/Reset Buttons
                if (tmpl.id===DEFAULT_JOURNAL_TEMPLATE.id) {
                    new Setting(containerEl)
                        .setName('Reset Default Template')
                        .addButton(b=>b.setButtonText('Reset').setWarning().onClick(()=>{
                            const modal=new Modal(this.app);
                            modal.titleEl.setText('Reset Default Template');
                            modal.contentEl.createEl('p',{text:'Are you sure you want to reset the default template?'});
                            const btns=modal.contentEl.createEl('div',{cls:'voice-journal-modal-buttons'});
                            btns.createEl('button',{text:'Cancel'}).onclick=()=>modal.close();
                            btns.createEl('button',{text:'Reset',cls:'mod-warning'}).onclick=async()=>{
                                modal.close();
                                const idx=this.plugin.settings.templates.findIndex(t=>t.id===DEFAULT_JOURNAL_TEMPLATE.id);
                                if(idx>-1){ this.plugin.settings.templates.splice(idx,1, JSON.parse(JSON.stringify(DEFAULT_JOURNAL_TEMPLATE))); await this.plugin.saveSettings(); this.render(); new Notice('Default template reset'); }
                            };
                            modal.open();
                        }));
                } else {
                    new Setting(containerEl)
                        .setName('Remove Template')
                        .addButton(b=>b.setButtonText('Remove').setWarning().onClick(async()=>{
                            const i=this.plugin.settings.templates.findIndex(t=>t.id===tmpl.id);
                            if(i>-1){ 
                                // Remove the template
                                this.plugin.settings.templates.splice(i,1); 
                                
                                // Update the default template if it was the one being deleted
                                if (this.plugin.settings.defaultTemplate === tmpl.id) {
                                    // Set to first available template or empty string (not null) to avoid type errors
                                    this.plugin.settings.defaultTemplate = this.plugin.settings.templates[0]?.id || '';
                                }
                                
                                await this.plugin.saveSettings(); 
                                this.selectedTemplateId=this.plugin.settings.templates[0]?.id||null; 
                                this.render(); 
                            }
                        }));
                }
            }
        }
    }

    /**
     * Get children of a specific folder from a list of abstract files
     */
    private getFolderChildren(
        abstractFiles: FileStructure[],
        folderPath: string
    ): FileStructure[] {
        if (folderPath === '/') {
            return abstractFiles.filter(file => file.children);
        }
        for (const file of abstractFiles) {
            if (file.path === folderPath && file.children) {
                return file.children;
            } else if (file.children) {
                const result = this.getFolderChildren(file.children, folderPath);
                if (result.length > 0) {
                    return result;
                }
            }
        }
        return [];
    }
}
