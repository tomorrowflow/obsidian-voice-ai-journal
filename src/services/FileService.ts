import { App } from 'obsidian';

/**
 * FileService handles vault folder operations to reduce code complexity in main plugin.
 */
export class FileService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Ensures that a folder exists at the given path, creating parent folders as needed.
     */
    async ensureFolderExists(folderPath: string): Promise<void> {
        const existing = this.app.vault.getAbstractFileByPath(folderPath);
        if (!existing) {
            const parent = folderPath.substring(0, folderPath.lastIndexOf('/'));
            if (parent) {
                await this.ensureFolderExists(parent);
            }
            await this.app.vault.createFolder(folderPath);
        }
    }

    /**
     * Alias for ensureFolderExists for clarity
     */
    createFolderIfNotExists(path: string): Promise<void> {
        return this.ensureFolderExists(path);
    }
}
