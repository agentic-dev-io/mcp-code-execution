/**
 * Google Drive Tool: Get document
 * 
 * Retrieves a document from Google Drive
 */
import { callMCPTool } from '../../client/typescript.js';

interface GetDocumentInput {
  documentId: string;
  fields?: string;
}

interface GetDocumentResponse {
  content: string;
  title: string;
  metadata?: Record<string, any>;
}

/* Read a document from Google Drive */
export async function getDocument(input: GetDocumentInput): Promise<GetDocumentResponse> {
  return callMCPTool<GetDocumentResponse>('google_drive', 'get_document', input);
}

