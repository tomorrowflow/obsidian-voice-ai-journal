import { Setting, App } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';

/**
 * Handles rendering of general settings in its own tab
 */
export class GeneralSettingsTab {
    private plugin: VoiceAIJournalPlugin;
    private container: HTMLElement;

    constructor(app: App, plugin: VoiceAIJournalPlugin, containerEl: HTMLElement) {
        this.plugin = plugin;
        this.container = containerEl;
        this.initialize();
    }

    private async initialize(): Promise<void> {
        this.container.empty();
        // Audio & Recording Settings
        this.container.createEl('h3', { text: 'Audio & Recording Settings' });
        
        this.createDropdown(
            'Audio Quality',
            'Higher quality records more data but creates larger files',
            this.plugin.settings.audioQuality,
            ['low', 'medium', 'high'],
            async (value: 'low' | 'medium' | 'high') => {
                this.plugin.settings.audioQuality = value;
                await this.plugin.saveSettings();
            }
        );

        // Automatic Speech Detection toggle removed

        // Microphone selection omitted for brevity; follow similar pattern
    }

    private createDropdown<T extends string>(
        name: string,
        desc: string,
        current: T,
        options: T[],
        onChange: (value: T) => Promise<void>
    ) {
        new Setting(this.container)
            .setName(name)
            .setDesc(desc)
            .addDropdown(dropdown => {
                options.forEach(option => dropdown.addOption(option, option));
                dropdown.setValue(current);
                dropdown.onChange(async (val: string) => {
                    await onChange(val as T);
                });
            });
    }

    private createToggle(
        name: string,
        desc: string,
        current: boolean,
        onChange: (value: boolean) => Promise<void>
    ) {
        new Setting(this.container)
            .setName(name)
            .setDesc(desc)
            .addToggle(toggle => {
                toggle.setValue(current);
                toggle.onChange(async (val: boolean) => {
                    await onChange(val);
                });
            });
    }
}
