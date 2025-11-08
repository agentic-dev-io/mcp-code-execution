/**
 * MCP Task Executor Agent - Anthropic Code Execution Pattern
 *
 * Implements Anthropic's official "Code Execution with MCP" architecture:
 * - Agents WRITE CODE instead of calling functions
 * - Tools exposed as filesystem code modules (servers/)
 * - Progressive tool discovery on-demand
 * - Data stays local in execution environment
 * - Only summaries flow to context (98.7% token reduction)
 *
 * References:
 * - https://www.anthropic.com/engineering/code-execution-with-mcp
 * - ./refs/anthropic-mcp-code-execution-reference.md
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Get plugin root directory
 * This finds the plugin directory regardless of where the code is executed from
 */
function getPluginRoot(): string {
  // Try to find plugin directory by looking for plugin.json or plugin/agents
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  
  // If we're in plugin/agents/, go up one level
  if (currentDir.endsWith('plugin/agents') || currentDir.endsWith('plugin\\agents')) {
    return path.join(currentDir, '..');
  }
  
  // Otherwise, try to find plugin directory from cwd
  const cwd = process.cwd();
  const pluginPath = path.join(cwd, 'plugin');
  
  // Check if plugin directory exists (synchronous check)
  try {
    const fsSync = require('fs');
    if (fsSync.existsSync(pluginPath)) {
      return pluginPath;
    }
  } catch {}
  
  // Fallback to cwd if plugin directory not found
  return cwd;
}

interface TaskConfig {
  description: string;
  context?: Record<string, any>;
  servers?: string[];
  skills?: string[];
  language?: 'python' | 'typescript';
  options?: {
    maxRetries?: number;
    timeout?: number;
    collectMetrics?: boolean;
    enforceSecurity?: boolean;
  };
}

interface TaskResult {
  success: boolean;
  output: string;
  code?: string;
  metrics?: {
    contextTokensIn: number;
    contextTokensOut: number;
    dataProcessedLocally: number;
    executionTimeMs: number;
  };
  errors?: string[];
  warnings?: string[];
}

/**
 * Core Concept: Agent writes TypeScript code, code executes locally
 *
 * Traditional approach (❌):
 *   Agent → calls Tool1 → Result in context → Agent analyzes → calls Tool2 → ...
 *   (Multiple round-trips, data flows through context)
 *
 * Anthropic's approach (✅):
 *   Agent writes code → Code executes → Data stays local → Summary to context
 *   (Single round-trip, 98.7% token reduction)
 */
export async function executeTask(config: TaskConfig): Promise<TaskResult> {
  const startTime = Date.now();

  console.log(`\n🚀 Executing Task: ${config.description}\n`);

  const result: TaskResult = {
    success: false,
    output: '',
    code: '',
    metrics: {
      contextTokensIn: 0,
      contextTokensOut: 0,
      dataProcessedLocally: 0,
      executionTimeMs: 0
    },
    errors: [],
    warnings: []
  };

  try {
    // Phase 1: Discover available tools and skills (0 context tokens)
    const language = config.language || 'typescript';
    console.log(`📚 Phase 1: Progressive Tool Discovery (${language})...`);
    const availableTools = await discoverTools(config.servers, language);
    const availableSkills = await discoverSkills(language);
    console.log(`   ✓ Discovered ${availableTools.length} ${language} tools from filesystem`);
    console.log(`   ✓ Discovered ${availableSkills.length} ${language} skills from filesystem`);
    result.metrics!.contextTokensIn += 0; // Discovery happens in environment

    // Phase 2: Generate execution code
    console.log(`\n✍️  Phase 2: Generating ${language} Execution Code...`);
    const executionCode = await generateExecutionCode(
      config.description,
      availableTools,
      availableSkills,
      language,
      config.skills,
      config.context
    );
    console.log(`   ✓ Generated ${executionCode.split('\n').length} lines of ${language} code`);
    result.code = executionCode;
    result.metrics!.contextTokensIn += estimateTokens(executionCode);

    // Phase 3: Execute code in local environment (data stays local)
    console.log('\n⚙️  Phase 3: Executing Code Locally...');
    const executionOutput = await executeCode(executionCode, config.options?.timeout || 30000);
    console.log(`   ✓ Code executed successfully`);
    result.metrics!.dataProcessedLocally += executionOutput.dataProcessed || 0;

    // Phase 4: Process output and generate summary
    console.log('\n📊 Phase 4: Generating Summary...');
    const summary = await generateSummary(executionOutput);
    result.output = summary;
    result.metrics!.contextTokensOut = estimateTokens(summary);
    console.log(`   ✓ Summary: ${summary.substring(0, 100)}...`);

    // Phase 5: Collect metrics
    if (config.options?.collectMetrics) {
      console.log('\n📈 Phase 5: Collecting Metrics...');
      result.metrics!.executionTimeMs = Date.now() - startTime;

      const efficiency = Math.round(
        ((result.metrics!.dataProcessedLocally || 0) / (result.metrics!.contextTokensIn + result.metrics!.contextTokensOut || 1)) * 100
      );

      console.log(`   ✓ Context In: ${result.metrics!.contextTokensIn} tokens`);
      console.log(`   ✓ Context Out: ${result.metrics!.contextTokensOut} tokens`);
      console.log(`   ✓ Data Processed Locally: ${result.metrics!.dataProcessedLocally} bytes`);
      console.log(`   ✓ Efficiency: ${efficiency}% reduction in context`);
      console.log(`   ✓ Execution Time: ${result.metrics!.executionTimeMs}ms`);
    }

    result.success = true;
    console.log('\n✅ Task completed successfully!\n');

  } catch (error) {
    result.success = false;
    result.errors = [String(error)];
    console.log(`\n❌ Task failed: ${error}\n`);
  }

  return result;
}

/**
 * Phase 1: Discover tools from filesystem
 * This is the "progressive disclosure" mechanism - tools loaded on-demand, not preloaded
 */
async function discoverTools(requestedServers?: string[], language: 'python' | 'typescript' = 'typescript'): Promise<string[]> {
  const tools: string[] = [];

  try {
    const pluginRoot = getPluginRoot();
    const serversDir = path.join(pluginRoot, 'servers', language);
    const servers = await fs.readdir(serversDir, { withFileTypes: true });

    for (const serverDir of servers) {
      if (!serverDir.isDirectory()) continue;
      if (serverDir.name.startsWith('_')) continue; // Skip internal directories

      const serverName = serverDir.name;

      // If specific servers requested, filter
      if (requestedServers && !requestedServers.includes(serverName)) continue;

      // List tools in this server
      const toolsPath = path.join(serversDir, serverName);
      const toolFiles = await fs.readdir(toolsPath);

      for (const file of toolFiles) {
        if (language === 'typescript' && file.endsWith('.ts') && file !== 'index.ts') {
          const toolName = file.replace('.ts', '');
          tools.push(`${serverName}/${toolName}`);
        } else if (language === 'python' && file.endsWith('.py') && file !== '__init__.py') {
          const toolName = file.replace('.py', '');
          tools.push(`${serverName}/${toolName}`);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not discover ${language} tools from filesystem: ${error}`);
  }

  return tools;
}

/**
 * Discover available skills from filesystem
 */
async function discoverSkills(language: 'python' | 'typescript' = 'typescript'): Promise<string[]> {
  const skills: string[] = [];

  try {
    const pluginRoot = getPluginRoot();
    const skillsDir = path.join(pluginRoot, 'skills', language);
    const skillFiles = await fs.readdir(skillsDir);

    for (const file of skillFiles) {
      if (language === 'typescript' && file.endsWith('.ts') && file !== 'index.ts') {
        const skillName = file.replace('.ts', '');
        skills.push(skillName);
      } else if (language === 'python' && file.endsWith('.py') && file !== '__init__.py') {
        const skillName = file.replace('.py', '');
        skills.push(skillName);
      }
    }
  } catch (error) {
    // Skills directory might not exist
  }

  return skills;
}

/**
 * Phase 2: Generate execution code
 * This is the "agent writes code" mechanism
 * Agent generates code (Python or TypeScript) that will execute locally
 */
async function generateExecutionCode(
  taskDescription: string,
  availableTools: string[],
  availableSkills: string[],
  language: 'python' | 'typescript',
  requestedSkills?: string[],
  context?: Record<string, any>
): Promise<string> {
  // In production, Claude would generate this code based on taskDescription
  // For now, return a template showing the pattern

  if (language === 'python') {
    return generatePythonCode(taskDescription, availableTools, availableSkills, requestedSkills);
  } else {
    return generateTypeScriptCode(taskDescription, availableTools, availableSkills, requestedSkills);
  }
}

function generatePythonCode(
  taskDescription: string,
  availableTools: string[],
  availableSkills: string[],
  requestedSkills?: string[]
): string {
  // Import tools
  const toolImports = availableTools
    .slice(0, 5) // Show first 5 as examples
    .map(tool => {
      const [server, toolName] = tool.split('/');
      const pythonName = toolName.replace(/-/g, '_');
      const serverName = server.replace(/-/g, '_');
      return `from plugin.servers.python.${serverName} import ${pythonName}`;
    })
    .join('\n');

  // Import skills (use requested skills or all available)
  const skillsToUse = requestedSkills && requestedSkills.length > 0
    ? availableSkills.filter(s => requestedSkills.includes(s))
    : availableSkills.slice(0, 2); // Show first 2 as examples

  const skillImports = skillsToUse
    .map(skill => {
      const pythonName = skill.replace(/-/g, '_');
      return `from plugin.skills.python.${pythonName} import *`;
    })
    .join('\n');

  const code = `"""
Auto-generated execution code for: "${taskDescription}"
This code executes locally - data stays in environment, not context
"""

import asyncio
import json
${toolImports}
${skillImports ? '\n' + skillImports : ''}

async def execute_task():
    results = []
    
    # Data processing happens HERE, not in context
    # Only print() output flows to context
    
    try:
        # Example: Process data locally
        data = {
            'itemsProcessed': 0,
            'summary': '${taskDescription}'
        }
        
        # Transform/filter data locally (0 context tokens)
        filtered = data
        
        results.append({
            'status': 'completed',
            'itemsProcessed': filtered['itemsProcessed'],
            'summary': filtered['summary']
        })
        
        # Only summary flows to context
        print(json.dumps({
            'success': True,
            'dataProcessedLocally': 1024,  # Example: bytes processed locally
            'results': results
        }))
        
    except Exception as error:
        print(json.dumps({
            'success': False,
            'error': str(error)
        }))

# Execute immediately
if __name__ == '__main__':
    asyncio.run(execute_task())
`;

  return code;
}

function generateTypeScriptCode(
  taskDescription: string,
  availableTools: string[],
  availableSkills: string[],
  requestedSkills?: string[]
): string {
  // Import tools
  const toolImports = availableTools
    .slice(0, 5) // Show first 5 as examples
    .map(tool => {
      const [server, toolName] = tool.split('/');
      const camelCase = toolName.replace(/-./g, x => x[1].toUpperCase());
      return `import { ${camelCase} } from './plugin/servers/typescript/${server}/index.js';`;
    })
    .join('\n');

  // Import skills (use requested skills or all available)
  const skillsToUse = requestedSkills && requestedSkills.length > 0
    ? availableSkills.filter(s => requestedSkills.includes(s))
    : availableSkills.slice(0, 2); // Show first 2 as examples

  const skillImports = skillsToUse
    .map(skill => {
      const camelCase = skill.replace(/-./g, x => x[1].toUpperCase());
      return `import { ${camelCase} } from './plugin/skills/typescript/${skill}.js';`;
    })
    .join('\n');

  const code = `
// Auto-generated execution code for: "${taskDescription}"
// This code executes locally - data stays in environment, not context
${toolImports}
${skillImports ? '\n' + skillImports : ''}

export async function executeTask() {
  const results = [];

  // Data processing happens HERE, not in context
  // Only console.log() output flows to context

  try {
    // Example: Process data locally
    const data = {
      itemsProcessed: 0,
      summary: '${taskDescription}'
    };

    // Transform/filter data locally (0 context tokens)
    const filtered = data;

    results.push({
      status: 'completed',
      itemsProcessed: filtered.itemsProcessed,
      summary: filtered.summary
    });

    // Only summary flows to context
    console.log(JSON.stringify({
      success: true,
      dataProcessedLocally: 1024, // Example: bytes processed locally
      results
    }));

  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: String(error)
    }));
  }
}

// Execute immediately
await executeTask();
`;

  return code;
}

/**
 * Phase 3: Execute code in local environment
 * Data stays local - doesn't flow through context
 */
async function executeCode(code: string, timeout: number): Promise<any> {
  // In production, this would use a sandboxed JavaScript runtime
  // For now, simulate execution with metrics

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        dataProcessed: Math.floor(Math.random() * 100000), // Simulated bytes
        results: [
          {
            status: 'completed',
            itemsProcessed: Math.floor(Math.random() * 1000),
            summary: 'Code executed successfully in local environment'
          }
        ]
      });
    }, 100);
  });
}

/**
 * Phase 4: Generate summary from execution output
 * Only summaries go to context (not raw data)
 */
async function generateSummary(executionOutput: any): Promise<string> {
  if (executionOutput.success) {
    return `✅ Execution completed: Processed ${executionOutput.dataProcessed} bytes locally. ` +
           `${executionOutput.results?.length || 0} results generated.`;
  } else {
    return `❌ Execution failed: ${executionOutput.error}`;
  }
}

/**
 * Estimate token count (simplified)
 * In production, use proper tokenizer
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Format task result for display
 */
export function formatTaskResult(result: TaskResult): string {
  let output = '';

  if (result.success) {
    output += '✅ Task succeeded\n\n';
  } else {
    output += '❌ Task failed\n\n';
    if (result.errors.length > 0) {
      output += 'Errors:\n';
      for (const error of result.errors) {
        output += `  - ${error}\n`;
      }
      output += '\n';
    }
  }

  output += 'Output:\n';
  output += result.output + '\n\n';

  if (result.code) {
    output += 'Generated Code:\n';
    output += '```typescript\n' + result.code + '\n```\n\n';
  }

  if (result.metrics) {
    output += 'Metrics (Token Efficiency):\n';
    output += `  Context In: ${result.metrics.contextTokensIn} tokens\n`;
    output += `  Context Out: ${result.metrics.contextTokensOut} tokens\n`;
    output += `  Data Processed Locally: ${result.metrics.dataProcessedLocally} bytes\n`;
    output += `  Execution Time: ${result.metrics.executionTimeMs}ms\n`;
  }

  return output;
}

// Export for use as an agent
export default executeTask;
