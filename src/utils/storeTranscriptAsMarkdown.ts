import { TFile } from 'obsidian';
import type VoiceAIJournalPlugin from '../../main';

/**
 * Store a transcript as a markdown note in the selected transcripts folder.
 * @param plugin VoiceAIJournalPlugin instance
 * @param transcriptText The transcript text to save
 * @param baseFileName The base file name (without extension)
 * @returns The TFile of the created note
 */
import { storeFileWithStructure } from './fileStoreUtils';

export async function storeTranscriptAsMarkdown(
  plugin: VoiceAIJournalPlugin,
  transcriptText: string,
  baseFileName: string,
  date?: Date
): Promise<TFile | null> {
  return await storeFileWithStructure({
    plugin,
    type: 'transcript',
    baseFileName: '', // filename is generated in buildStructuredPath
    content: transcriptText,
    date,
    extension: '.md',
  });
}
