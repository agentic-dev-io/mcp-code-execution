/**
 * Salesforce Tool: Update record
 * 
 * Updates a record in Salesforce
 */
import { callMCPTool } from '../../client/typescript.js';

interface UpdateRecordInput {
  objectType: string;
  recordId: string;
  data: Record<string, any>;
}

interface UpdateRecordResponse {
  id: string;
  success: boolean;
  updatedFields: Record<string, any>;
}

/* Update a record in Salesforce */
export async function updateRecord(input: UpdateRecordInput): Promise<UpdateRecordResponse> {
  return callMCPTool<UpdateRecordResponse>('salesforce', 'update_record', input);
}

