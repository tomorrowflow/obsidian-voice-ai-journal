// No need to import TFile directly as it's included in FileStoreResult
import type VoiceAIJournalPlugin from '../../main';
import { storeFileWithStructureEnhanced, FileStoreResult } from './fileStoreUtils';

/**
 * Store a transcript as a markdown note in the selected transcripts folder.
 * @param plugin VoiceAIJournalPlugin instance
 * @param transcriptText The transcript text to save
 * @param baseFileName The base file name (without extension)
 * @returns Object containing the TFile and the file path
 */

export type TranscriptStoreResult = FileStoreResult;

export async function storeTranscriptAsMarkdown(
  plugin: VoiceAIJournalPlugin,
  transcriptText: string,
  baseFileName: string,
  date?: Date
): Promise<TranscriptStoreResult> {
  const targetDate = date || new Date();
  return await storeFileWithStructureEnhanced({
    plugin,
    type: 'transcript',
    baseFileName: '', // filename is generated in buildStructuredPath
    content: transcriptText,
    date: targetDate,
    extension: '.md',
  });
}
