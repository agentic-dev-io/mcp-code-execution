/**
 * Google Drive Tool: List documents
 * 
 * Example tool for Google Drive server integration
 */
import { callMCPTool } from '../../client/typescript.js';

interface ListDocumentsInput {
  folderId?: string;
}

interface ListDocumentsResponse {
  documents: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

/* List documents from Google Drive */
export async function listDocuments(input: ListDocumentsInput = {}): Promise<ListDocumentsResponse> {
  return callMCPTool<ListDocumentsResponse>('google_drive', 'list_documents', input);
}

