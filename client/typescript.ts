/**
 * MCP Client for TypeScript Code Execution
 * 
 * Usage in server wrappers:
 *   import { callMCPTool } from './client/typescript.js';
 *   
 *   const result = await callMCPTool('server_name', 'tool_name', { param: 'value' });
 */

/**
 * Call MCP tool.
 * 
 * @param server Name of MCP server (e.g. 'google-drive')
 * @param tool Name of tool (e.g. 'getDocument')
 * @param args Parameters as object
 * @returns Tool result
 */
export async function callMCPTool<T = any>(
  server: string,
  tool: string,
  args: Record<string, any>
): Promise<T> {
  // In Claude Code, this function is provided by the runtime
  // For local tests, mock this function
  throw new Error(
    'callMCPTool is provided by Claude Code Runtime. ' +
    'For local tests, mock this function.'
  );
}
