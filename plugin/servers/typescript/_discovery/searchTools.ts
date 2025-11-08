/**
 * Tool Discovery: Search Tools
 * 
 * Implements the search_tools pattern from Anthropic's code execution approach.
 * Allows agents to search for relevant tools by name or description.
 * 
 * Usage:
 *   import { searchTools } from './servers/typescript/_discovery/searchTools.js';
 *   const tools = await searchTools({ query: 'google drive', detailLevel: 'full' });
 */

import fs from 'fs/promises';
import path from 'path';

export interface SearchToolsInput {
  query?: string;
  detailLevel?: 'name' | 'description' | 'full';
  server?: string;
}

export interface ToolInfo {
  server: string;
  tool: string;
  name?: string;
  description?: string;
  fullDefinition?: string;
}

export interface SearchToolsResponse {
  tools: ToolInfo[];
  total: number;
}

/**
 * Search for tools across all servers
 * 
 * @param input Search parameters
 * @returns Matching tools with requested detail level
 */
export async function searchTools(input: SearchToolsInput = {}): Promise<SearchToolsResponse> {
  const { query, detailLevel = 'name', server: requestedServer } = input;
  
  const tools: ToolInfo[] = [];
  const serversDir = path.join(process.cwd(), 'servers', 'typescript');
  
  try {
    const servers = await fs.readdir(serversDir, { withFileTypes: true });
    
    for (const serverDir of servers) {
      if (!serverDir.isDirectory()) continue;
      
      const serverName = serverDir.name;
      
      // Filter by server if requested
      if (requestedServer && serverName !== requestedServer) continue;
      
      const toolsPath = path.join(serversDir, serverName);
      const toolFiles = await fs.readdir(toolsPath);
      
      for (const file of toolFiles) {
        if (!file.endsWith('.ts') || file === 'index.ts') continue;
        
        const toolName = file.replace('.ts', '');
        const toolPath = path.join(toolsPath, file);
        
        // Read tool file for description
        let name = toolName;
        let description = '';
        let fullDefinition = '';
        
        if (detailLevel !== 'name') {
          try {
            const content = await fs.readFile(toolPath, 'utf-8');
            
            // Extract description from comments
            const commentMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
            if (commentMatch) {
              description = commentMatch[1]
                .split('\n')
                .map(line => line.replace(/^\s*\*\s?/, '').trim())
                .filter(line => line && !line.startsWith('@'))
                .join(' ')
                .trim();
            }
            
            if (detailLevel === 'full') {
              fullDefinition = content;
            }
          } catch (error) {
            // Ignore read errors
          }
        }
        
        // Filter by query if provided
        if (query) {
          const searchText = `${serverName} ${toolName} ${description}`.toLowerCase();
          if (!searchText.includes(query.toLowerCase())) {
            continue;
          }
        }
        
        const toolInfo: ToolInfo = {
          server: serverName,
          tool: toolName
        };
        
        if (detailLevel !== 'name') {
          toolInfo.name = name;
          toolInfo.description = description;
        }
        
        if (detailLevel === 'full') {
          toolInfo.fullDefinition = fullDefinition;
        }
        
        tools.push(toolInfo);
      }
    }
  } catch (error) {
    console.warn(`Could not search tools: ${error}`);
  }
  
  return {
    tools,
    total: tools.length
  };
}

