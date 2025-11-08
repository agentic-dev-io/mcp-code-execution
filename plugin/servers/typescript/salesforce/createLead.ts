/**
 * Salesforce Tool: Create lead
 * 
 * Example tool for Salesforce server integration
 */
import { callMCPTool } from '../../client/typescript.js';

interface CreateLeadInput {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
}

interface CreateLeadResponse {
  id: string;
  success: boolean;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
}

/* Create a new lead in Salesforce */
export async function createLead(input: CreateLeadInput): Promise<CreateLeadResponse> {
  return callMCPTool<CreateLeadResponse>('salesforce', 'create_lead', input);
}

