/**
 * Generate Server Wrappers Command
 *
 * Automatically generates Python and TypeScript wrapper modules for configured MCP servers.
 * For each server, generates:
 * - Python modules in servers/python/{server_name}/
 * - TypeScript modules in servers/typescript/{serverName}/
 * - Type definitions and docstrings
 */

import * as fs from 'fs';
import * as path from 'path';

interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  description?: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export async function generateWrappers(
  serverName?: string,
  mcpConfig?: Record<string, any>
): Promise<void> {
  // Load config if not provided
  if (!mcpConfig) {
    const configPath = path.join(process.cwd(), 'mcp_config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('mcp_config.json not found');
    }
    mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  const servers = mcpConfig.mcpServers || {};
  const targetServers = serverName ? [serverName] : Object.keys(servers);

  console.log(`\n🔧 Generating MCP server wrappers for: ${targetServers.join(', ')}\n`);

  for (const name of targetServers) {
    if (!servers[name]) {
      console.log(`❌ Server not found: ${name}`);
      continue;
    }

    console.log(`\n📝 Generating wrappers for: ${name}`);
    await generateServerWrappers(name, servers[name]);
  }

  console.log('\n✅ Wrapper generation complete!\n');
}

async function generateServerWrappers(serverName: string, config: ServerConfig): Promise<void> {
  // For demo purposes, we'll generate a template wrapper
  // In production, this would connect to the MCP server and list its tools

  const pythonDir = path.join(process.cwd(), 'servers', 'python', serverName);
  const typescriptDir = path.join(process.cwd(), 'servers', 'typescript', serverName);

  // Create directories
  fs.mkdirSync(pythonDir, { recursive: true });
  fs.mkdirSync(typescriptDir, { recursive: true });

  // Example tools (in production, these would be discovered from the server)
  const exampleTools = [
    {
      name: 'example_tool_1',
      description: 'Example tool 1',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Parameter 1' }
        },
        required: ['param1']
      }
    },
    {
      name: 'example_tool_2',
      description: 'Example tool 2',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Parameter 1' },
          param2: { type: 'number', description: 'Parameter 2' }
        },
        required: ['param1']
      }
    }
  ];

  // Generate Python wrappers
  console.log(`   Creating Python wrapper modules...`);
  generatePythonWrappers(pythonDir, serverName, exampleTools);

  // Generate TypeScript wrappers
  console.log(`   Creating TypeScript wrapper modules...`);
  generateTypescriptWrappers(typescriptDir, serverName, exampleTools);
}

function generatePythonWrappers(dir: string, serverName: string, tools: ToolDefinition[]): void {
  // Create __init__.py
  const imports = tools.map(t => t.name).join(', ');
  const initContent = `"""
${serverName.replace(/-/g, '_')} MCP Server Wrappers

Auto-generated wrappers for the ${serverName} MCP server.
"""

${tools.map(t => `from .${t.name} import ${toPythonName(t.name)}`).join('\n')}

__all__ = [${tools.map(t => `'${toPythonName(t.name)}'`).join(', ')}]
`;

  fs.writeFileSync(path.join(dir, '__init__.py'), initContent);

  // Create wrapper for each tool
  for (const tool of tools) {
    const pythonName = toPythonName(tool.name);
    const params = Object.entries(tool.inputSchema.properties || {})
      .map(([key, spec]: [string, any]) => `${key}: ${getPythonType(spec.type)}`)
      .join(', ');

    const docParams = Object.entries(tool.inputSchema.properties || {})
      .map(([key, spec]: [string, any]) => `        ${key}: ${spec.description || 'Parameter'}`)
      .join('\n');

    const callParams = Object.keys(tool.inputSchema.properties || {})
      .map(key => `'${key}': ${key}`)
      .join(', ');

    const content = `"""
${pythonName} - ${tool.description}
"""

from typing import Any, Dict
from client.python import call_mcp_tool


async def ${pythonName}(${params}) -> Dict[str, Any]:
    """
    ${tool.description}

    Args:
${docParams}

    Returns:
        Tool result from MCP server

    Raises:
        MCPError: If the tool call fails
        ConnectionError: If connection to server fails
    """
    return await call_mcp_tool(
        '${serverName.replace(/_/g, '-')}',
        '${tool.name}',
        {${callParams}}
    )
`;

    fs.writeFileSync(path.join(dir, `${pythonName}.py`), content);
  }

  console.log(`      ✓ Created ${tools.length} Python wrapper modules`);
}

function generateTypescriptWrappers(
  dir: string,
  serverName: string,
  tools: ToolDefinition[]
): void {
  // Create index.ts
  const imports = tools
    .map(t => `export { ${toCamelCase(t.name)} } from './${toCamelCase(t.name)}.js';`)
    .join('\n');

  const indexContent = `/**
 * ${serverName} MCP Server Wrappers
 *
 * Auto-generated wrappers for the ${serverName} MCP server.
 */

${imports}
`;

  fs.writeFileSync(path.join(dir, 'index.ts'), indexContent);

  // Create wrapper for each tool
  for (const tool of tools) {
    const camelName = toCamelCase(tool.name);
    const params = Object.entries(tool.inputSchema.properties || {})
      .map(([key, spec]: [string, any]) => `${key}: ${getTypescriptType(spec.type)}`)
      .join(', ');

    const docParams = Object.entries(tool.inputSchema.properties || {})
      .map(([key, spec]: [string, any]) => `   * @param ${key} - ${spec.description || 'Parameter'}`)
      .join('\n');

    const callParams = Object.keys(tool.inputSchema.properties || {})
      .map(key => `'${key}': ${key}`)
      .join(', ');

    const content = `/**
 * ${camelName} - ${tool.description}
 *
${docParams}
 * @returns {Promise<Record<string, any>>} Tool result from MCP server
 */
export async function ${camelName}(${params}): Promise<Record<string, any>> {
  // Import here to avoid circular dependencies
  const { callMCPTool } = await import('../../client/typescript.js');

  return await callMCPTool(
    '${serverName.replace(/_/g, '-')}',
    '${tool.name}',
    {${callParams}}
  );
}
`;

    fs.writeFileSync(path.join(dir, `${camelName}.ts`), content);
  }

  console.log(`      ✓ Created ${tools.length} TypeScript wrapper modules`);
}

// Helper functions
function toPythonName(name: string): string {
  return name.replace(/-/g, '_');
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function getPythonType(jsonType: string): string {
  const typeMap: Record<string, string> = {
    string: 'str',
    number: 'float',
    integer: 'int',
    boolean: 'bool',
    array: 'list',
    object: 'dict'
  };
  return typeMap[jsonType] || 'Any';
}

function getTypescriptType(jsonType: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    array: 'any[]',
    object: 'Record<string, any>'
  };
  return typeMap[jsonType] || 'any';
}

// Export for use as a command
export default generateWrappers;
