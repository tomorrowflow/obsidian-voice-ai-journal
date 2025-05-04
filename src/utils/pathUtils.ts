import { TFile } from 'obsidian';

/**
 * Converts a file path to an Obsidian wiki link format
 * @param path The file path to convert
 * @returns The path in Obsidian wiki link format [[path/to/file]]
 */
export function pathToWikiLink(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  // Return the path in Obsidian wiki link format with quotes
  return `[[${cleanPath}]]`;
}

/**
 * Gets the relative path of a file from the vault root
 * @param file The TFile object
 * @returns The relative path as a wiki link
 */
export function fileToWikiLink(file: TFile): string {
  return pathToWikiLink(file.path);
}
