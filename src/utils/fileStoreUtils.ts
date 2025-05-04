import { TFile, Notice } from 'obsidian';
import { FileService } from '../services/FileService';
import type VoiceAIJournalPlugin from '../../main';

export type StoreFileType = 'note' | 'transcript' | 'audio';

interface StoreFileOptions {
  plugin: VoiceAIJournalPlugin;
  type: StoreFileType;
  baseFileName: string;
  content: string | ArrayBuffer;
  date?: Date;
  extension: string;
}

/**
 * Builds the folder path for a file based on its type and date.
 */
export function buildStructuredPath(plugin: VoiceAIJournalPlugin, type: StoreFileType, date: Date, baseFileName: string, extension: string): string {
  let baseFolder = '';
  if (type === 'note') baseFolder = plugin.settings.noteLocation || '/Journal';
  else if (type === 'transcript') baseFolder = plugin.settings.transcriptsLocation || '/Transcripts';
  else if (type === 'audio') baseFolder = plugin.settings.recordingsLocation || '/Recordings';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  let filename = baseFileName;
  if (type === 'transcript' || type === 'audio') {
    // Use full date and type postfix for transcript/recording
    const dateString = `${year}-${month}-${day}_${hour}-${minute}-${second}`;
    const postfix = type === 'transcript' ? '_transcript' : '_recording';
    filename = `${dateString}${postfix}`;
  }
  // For notes, just use the baseFileName as provided

  // Structure: [BaseFolder]/[Year]/[Month]/[filename][extension]
  const path = `${baseFolder}/${year}/${month}/${filename}${extension}`;
  return path.replace(/\/+/g, '/');
}

/**
 * Result of storing a file with structure
 */
export interface FileStoreResult {
  file: TFile | null;
  path: string;
}

/**
 * Stores a file (note, transcript, or audio) in a structured folder, creating folders as needed.
 */
export async function storeFileWithStructure(options: StoreFileOptions): Promise<TFile | null> {
  const { plugin, type, baseFileName, content, date, extension } = options;
  const targetDate = date || new Date();
  const filePath = buildStructuredPath(plugin, type, targetDate, baseFileName, extension);
  const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
  const fileService = new FileService(plugin.app);

  try {
    await fileService.ensureFolderExists(folderPath);
    let file: TFile | null = null;
    if (type === 'audio' && content instanceof ArrayBuffer) {
      await plugin.app.vault.createBinary(filePath, content);
      file = plugin.app.vault.getAbstractFileByPath(filePath) as TFile;
    } else if (typeof content === 'string') {
      const fileExists = await plugin.app.vault.adapter.exists(filePath);
      if (fileExists) {
        await plugin.app.vault.adapter.write(filePath, content);
      } else {
        await plugin.app.vault.create(filePath, content);
      }
      file = plugin.app.vault.getAbstractFileByPath(filePath) as TFile;
    }
    return file;
  } catch (err) {
    new Notice(`Failed to save ${type}: ${baseFileName}`);
    console.error(`Failed to save ${type}`, err);
    return null;
  }
}

/**
 * Enhanced version of storeFileWithStructure that returns both the file and its path
 */
export async function storeFileWithStructureEnhanced(options: StoreFileOptions): Promise<FileStoreResult> {
  const { plugin, type, baseFileName, content, date, extension } = options;
  const targetDate = date || new Date();
  const filePath = buildStructuredPath(plugin, type, targetDate, baseFileName, extension);
  const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
  const fileService = new FileService(plugin.app);

  try {
    await fileService.ensureFolderExists(folderPath);
    let file: TFile | null = null;
    if (type === 'audio' && content instanceof ArrayBuffer) {
      await plugin.app.vault.createBinary(filePath, content);
      file = plugin.app.vault.getAbstractFileByPath(filePath) as TFile;
    } else if (typeof content === 'string') {
      const fileExists = await plugin.app.vault.adapter.exists(filePath);
      if (fileExists) {
        await plugin.app.vault.adapter.write(filePath, content);
      } else {
        await plugin.app.vault.create(filePath, content);
      }
      file = plugin.app.vault.getAbstractFileByPath(filePath) as TFile;
    }
    return {
      file,
      path: filePath
    };
  } catch (err) {
    new Notice(`Failed to save ${type}: ${baseFileName}`);
    console.error(`Failed to save ${type}`, err);
    return {
      file: null,
      path: ''
    };
  }
}
