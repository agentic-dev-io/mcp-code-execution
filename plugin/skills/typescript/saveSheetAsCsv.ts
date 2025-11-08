/**
 * Skill: Save Google Drive Sheet as CSV
 * 
 * Reusable function to download a Google Drive spreadsheet and save it as CSV.
 * This demonstrates the Skills pattern from Anthropic's code execution approach.
 * 
 * Usage:
 *   import { saveSheetAsCsv } from './skills/typescript/saveSheetAsCsv.js';
 *   const csvPath = await saveSheetAsCsv('sheet-id-123');
 */

import * as gdrive from '../servers/typescript/google-drive/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Download a Google Drive sheet and save it as CSV
 * 
 * @param sheetId Google Drive sheet ID
 * @param outputDir Optional output directory (default: ./workspace)
 * @returns Path to saved CSV file
 */
export async function saveSheetAsCsv(
  sheetId: string,
  outputDir: string = './workspace'
): Promise<string> {
  // Get sheet data from Google Drive
  const sheetData = await gdrive.getDocument({ documentId: sheetId });
  
  // Convert to CSV format (simplified - assumes structured data)
  // In production, would parse actual sheet format
  const csvContent = typeof sheetData.content === 'string' 
    ? sheetData.content 
    : JSON.stringify(sheetData.content);
  
  // Save to file
  const csvPath = join(outputDir, `sheet-${sheetId}.csv`);
  await writeFile(csvPath, csvContent, 'utf-8');
  
  return csvPath;
}

