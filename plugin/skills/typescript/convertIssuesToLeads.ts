/**
 * Skill: Convert GitHub Issues to Salesforce Leads
 * 
 * Reusable function to fetch GitHub issues and create corresponding Salesforce leads.
 * Demonstrates cross-server tool composition.
 * 
 * Usage:
 *   import { convertIssuesToLeads } from './skills/typescript/convertIssuesToLeads.js';
 *   await convertIssuesToLeads('owner/repo', { state: 'open' });
 */

import * as github from '../servers/typescript/github/index.js';
import * as salesforce from '../servers/typescript/salesforce/index.js';

interface ConvertOptions {
  state?: 'open' | 'closed';
  limit?: number;
}

/**
 * Fetch GitHub issues and create Salesforce leads from them
 * 
 * @param repo Repository in format 'owner/repo'
 * @param options Conversion options
 * @returns Number of leads created
 */
export async function convertIssuesToLeads(
  repo: string,
  options: ConvertOptions = {}
): Promise<number> {
  const { state = 'open', limit = 100 } = options;
  
  // Fetch issues from GitHub
  const issuesResponse = await github.getIssues({ repo, state });
  const issues = issuesResponse.issues.slice(0, limit);
  
  // Create leads in Salesforce
  let created = 0;
  for (const issue of issues) {
    try {
      await salesforce.createLead({
        firstName: 'GitHub',
        lastName: `Issue #${issue.number}`,
        email: `issue-${issue.number}@github.com`,
        company: repo
      });
      created++;
    } catch (error) {
      console.error(`Failed to create lead for issue ${issue.number}: ${error}`);
    }
  }
  
  console.log(`Created ${created} leads from ${issues.length} GitHub issues`);
  return created;
}

