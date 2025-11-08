/**
 * MCP Client for TypeScript Code Execution
 * 
 * Implements full MCP client functionality using @modelcontextprotocol/sdk
 * 
 * Usage in server wrappers:
 *   import { callMCPTool } from '../../../client/typescript.js';
 *   
 *   const result = await callMCPTool('google_drive', 'get_document', { documentId: 'abc123' });
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class MCPError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class ConnectionTimeout extends Error {
  constructor(public timeoutSeconds: number) {
    super(`Connection timeout after ${timeoutSeconds}s`);
    this.name = 'ConnectionTimeout';
  }
}

class MCPClientWrapper {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  constructor(
    private server: string,
    private config: MCPServerConfig
  ) {}

  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    try {
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env
      });

      this.client = new Client({
        name: 'mcp-code-execution-client',
        version: '0.1.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new MCPError(-1, `Failed to connect to ${this.server}: ${error}`);
    }
  }

  async callTool<T = any>(
    tool: string,
    args: Record<string, any>,
    timeout: number = 30000
  ): Promise<T> {
    if (!this.connected || !this.client) {
      throw new MCPError(-1, `Not connected to ${this.server}`);
    }

    try {
      const result = await Promise.race([
        this.client.callTool({
          name: tool,
          arguments: args
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new ConnectionTimeout(timeout / 1000));
          }, timeout);
        })
      ]);

      return result.content?.[0]?.text 
        ? JSON.parse(result.content[0].text) 
        : result.content?.[0]?.data 
        ? result.content[0].data 
        : result as T;
    } catch (error) {
      if (error instanceof ConnectionTimeout) {
        throw error;
      }
      throw new MCPError(-1, `Tool call failed: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.client && this.transport) {
      try {
        await this.client.close();
        await this.transport.close();
      } catch (error) {
        // Ignore close errors
      }
      this.client = null;
      this.transport = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Global client cache
const clientCache = new Map<string, MCPClientWrapper>();

function getPluginRoot(): string {
  // Try to find plugin directory
  const cwd = process.cwd();
  
  // Check if we're in plugin directory
  if (cwd.includes('plugin')) {
    const parts = cwd.split(path.sep);
    const pluginIndex = parts.indexOf('plugin');
    if (pluginIndex >= 0) {
      return join(...parts.slice(0, pluginIndex + 1));
    }
  }
  
  // Check for plugin directory in cwd
  const pluginPath = join(cwd, 'plugin');
  try {
    const fsSync = require('fs');
    if (fsSync.existsSync(pluginPath)) {
      return pluginPath;
    }
  } catch {}
  
  // Fallback: check parent directory
  const parentPluginPath = join(cwd, '..', 'plugin');
  try {
    const fsSync = require('fs');
    if (fsSync.existsSync(parentPluginPath)) {
      return parentPluginPath;
    }
  } catch {}
  
  return cwd;
}

function loadMCPConfig(): Record<string, MCPServerConfig> {
  try {
    const pluginRoot = getPluginRoot();
    // Try plugin/config/mcp_config.json first, then root mcp_config.json
    const configPaths = [
      join(pluginRoot, 'config', 'mcp_config.json'),
      join(pluginRoot, 'mcp_config.json'),
      join(process.cwd(), 'mcp_config.json')
    ];
    
    for (const configPath of configPaths) {
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        return config.mcpServers || {};
      } catch {
        continue;
      }
    }
    
    return {};
  } catch (error) {
    console.warn(`Could not load mcp_config.json: ${error}`);
    return {};
  }
}

async function getOrCreateClient(
  server: string
): Promise<MCPClientWrapper> {
  const cacheKey = server;

  if (clientCache.has(cacheKey)) {
    const client = clientCache.get(cacheKey)!;
    if (client.isConnected()) {
      return client;
    }
  }

  const config = loadMCPConfig();
  if (!config[server]) {
    throw new MCPError(-1, `Server '${server}' not found in mcp_config.json`);
  }

  const client = new MCPClientWrapper(server, config[server]);
  await client.connect();
  clientCache.set(cacheKey, client);

  return client;
}

/**
 * Call MCP tool.
 * 
 * @param server Name of MCP server (e.g. 'google-drive')
 * @param tool Name of tool (e.g. 'get_document')
 * @param args Parameters as object
 * @returns Tool result
 */
export async function callMCPTool<T = any>(
  server: string,
  tool: string,
  args: Record<string, any>
): Promise<T> {
  const client = await getOrCreateClient(server);
  return client.callTool<T>(tool, args);
}

/**
 * Close all client connections
 */
export async function closeAllClients(): Promise<void> {
  const closePromises = Array.from(clientCache.values()).map(client => client.close());
  await Promise.all(closePromises);
  clientCache.clear();
}
