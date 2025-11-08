/**
 * GitHub Tool: Get issues
 * 
 * Example tool for GitHub server integration
 */
import { callMCPTool } from '../../client/typescript.js';

interface GetIssuesInput {
  repo: string;
  state?: 'open' | 'closed';
}

interface GetIssuesResponse {
  issues: Array<{
    number: number;
    title: string;
    state: string;
  }>;
}

/* Get issues from a GitHub repository */
export async function getIssues(input: GetIssuesInput): Promise<GetIssuesResponse> {
  return callMCPTool<GetIssuesResponse>('github', 'get_issues', input);
}

