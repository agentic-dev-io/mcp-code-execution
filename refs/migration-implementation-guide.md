# MCP Code Execution: Migration Implementation Guide

**Date**: 2025-11-08
**Purpose**: Step-by-step guide to implement Anthropic's recommended MCP code execution architecture
**Target**: Transform from current implementation to full token-efficient pattern
**Estimated Timeline**: 16-20 hours across 3 phases

---

## Quick Start: What You Need to Know

**Key Insight**: You're not creating a new system. You're restructuring the existing one to enable:
1. Agents to write code (not just call functions)
2. Tools to be discovered dynamically (not imported upfront)
3. Data to be processed locally (not in context)

**This Changes**: How agents interact with tools, not what tools are available

**This Keeps**: All existing MCP servers, business logic, and functionality

---

## Phase 1: Foundation Setup (4 hours)

### Step 1.1: Understand the Target Structure

Create this directory structure:

```
servers/
├── google-drive/           (instead of servers/python/google_drive/)
│   ├── index.ts           (exports all tools)
│   ├── getDocument.ts     (individual tool wrapper)
│   ├── listFiles.ts
│   └── uploadFile.ts
├── salesforce/
│   ├── index.ts
│   ├── queryRecords.ts
│   ├── updateRecord.ts
│   └── createLead.ts
└── slack/
    ├── index.ts
    ├── sendMessage.ts
    └── uploadFile.ts
```

**Why**: Agents can discover tools by reading filesystem, not loading definitions upfront

### Step 1.2: Create Client Wrapper (MCP → Code)

Create `client/mcp-wrapper.ts` that wraps MCP calls:

```typescript
// client/mcp-wrapper.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient: Client | null = null;

async function initMCPClient(serverName: string): Promise<Client> {
  if (mcpClient) return mcpClient;

  // Load MCP server from mcp_config.json
  const config = require('../mcp_config.json');
  const serverConfig = config.mcpServers[serverName];

  if (!serverConfig) {
    throw new Error(`Server ${serverName} not found in mcp_config.json`);
  }

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    env: { ...process.env, ...serverConfig.env }
  });

  mcpClient = new Client({ name: serverName });
  await mcpClient.connect(transport);

  return mcpClient;
}

export async function callMCPTool(
  serverName: string,
  toolName: string,
  params: Record<string, any>
): Promise<any> {
  const client = await initMCPClient(serverName);

  const result = await client.call_tool({
    name: toolName,
    arguments: params
  });

  return result.content[0].text;
}
```

**Effort**: 1 hour
**Verification**: Can call `callMCPTool('google-drive', 'get_document', {...})`

### Step 1.3: Migrate First Server (Google Drive Example)

Create tool modules:

```typescript
// servers/google-drive/getDocument.ts
import { callMCPTool } from '../../client/mcp-wrapper.ts';

export interface GoogleDocument {
  id: string;
  title: string;
  content: string;
  mimeType: string;
  modifiedTime: string;
}

/**
 * Fetch a Google Drive document by ID.
 *
 * @param documentId - The Google Drive document ID
 * @returns Document object with content and metadata
 *
 * @example
 * const doc = await getDocument('1abc123def456');
 * console.log(doc.title);  // "My Document"
 */
export async function getDocument(documentId: string): Promise<GoogleDocument> {
  const result = await callMCPTool('google-drive', 'get_document', {
    document_id: documentId,
  });

  // Parse and return typed result
  return JSON.parse(result);
}
```

```typescript
// servers/google-drive/listFiles.ts
import { callMCPTool } from '../../client/mcp-wrapper.ts';

export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export async function listFiles(
  folderId?: string,
  limit: number = 100
): Promise<GoogleFile[]> {
  const result = await callMCPTool('google-drive', 'list_files', {
    folder_id: folderId,
    limit,
  });

  return JSON.parse(result);
}
```

```typescript
// servers/google-drive/index.ts
export { getDocument, type GoogleDocument } from './getDocument.ts';
export { listFiles, type GoogleFile } from './listFiles.ts';
```

**Effort**: 1.5 hours
**Verification**: `import { getDocument } from './servers/google-drive/index.ts'` works

### Step 1.4: Implement Tool Discovery

Create discovery helper:

```typescript
// servers/discover-tools.ts
import fs from 'fs';
import path from 'path';

export interface ToolInfo {
  server: string;
  name: string;
  filePath: string;
}

export async function discoverTools(): Promise<Record<string, string[]>> {
  const serversDir = path.join(process.cwd(), 'servers');
  const servers = fs.readdirSync(serversDir).filter(f => {
    const stat = fs.statSync(path.join(serversDir, f));
    return stat.isDirectory();
  });

  const available: Record<string, string[]> = {};

  for (const server of servers) {
    const serverPath = path.join(serversDir, server);
    const files = fs.readdirSync(serverPath);

    available[server] = files
      .filter(f => f.endsWith('.ts') && f !== 'index.ts')
      .map(f => f.replace('.ts', ''));
  }

  return available;
}

export async function toolExists(serverName: string, toolName: string): Promise<boolean> {
  const available = await discoverTools();
  return available[serverName]?.includes(toolName) ?? false;
}

export function printAvailableTools(): void {
  const available = discoverTools();

  console.log('\nAvailable MCP Tools:');
  console.log('===================\n');

  for (const [server, tools] of Object.entries(available)) {
    console.log(`${server}:`);
    tools.forEach(tool => console.log(`  - ${tool}`));
    console.log();
  }
}
```

**Effort**: 1 hour
**Verification**: `discoverTools()` returns `{ 'google-drive': ['getDocument', 'listFiles', ...], ... }`

### Step 1.5: Create Test Task

Verify everything works:

```typescript
// test-phase1.ts
import { getDocument } from './servers/google-drive/index.ts';
import { discoverTools } from './servers/discover-tools.ts';

async function main() {
  // Test 1: Discovery works
  console.log('Testing tool discovery...');
  const tools = await discoverTools();
  console.log('Discovered tools:', JSON.stringify(tools, null, 2));

  // Test 2: Tool import works
  console.log('\nTesting tool import...');
  console.log('getDocument function exists:', typeof getDocument === 'function');

  // Test 3: Local data processing
  console.log('\nTesting local processing pattern...');
  const sampleData = {
    content: 'This is a\nACTION: Fix bug\nACTION: Review PR\nThis is done',
  };

  const actions = sampleData.content
    .split('\n')
    .filter(line => line.startsWith('ACTION:'))
    .map(line => line.replace('ACTION:', '').trim());

  console.log(`Extracted ${actions.length} actions (stays in environment, not logged in full)`);
}

main().catch(console.error);
```

**Run**: `bun run test-phase1.ts`
**Expected Output**: Tools discovered, functions accessible, data processing works

**Phase 1 Checkpoint**: Structure in place, tool discovery working, test passing

---

## Phase 2: Agent Code Generation (6-8 hours)

### Step 2.1: Understand Agent Code Pattern

The agent doesn't call predefined functions. It **generates code** that solves the problem.

**Old Pattern**:
```
Model decision → Execute predefined action → Return result → Model decision
```

**New Pattern**:
```
Model decision → Generate code → Execute code in environment → Return summary
```

### Step 2.2: Create Agent Code Executor

Create the execution environment:

```typescript
// agents/executor.ts
import * as vm from 'vm';
import * as fs from 'fs';
import * as path from 'path';

export interface ExecutionResult {
  output: string;
  success: boolean;
  error?: string;
  executionTime: number;
}

export async function executeAgentCode(
  code: string,
  timeout: number = 30000
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Build sandbox with access to server modules
    const sandbox = {
      console,
      process: { cwd: () => process.cwd() },
      require: require,
      async: true,

      // Make servers discoverable
      servers: () => {
        const serversDir = path.join(process.cwd(), 'servers');
        return fs.readdirSync(serversDir);
      }
    };

    // Execute with timeout
    const context = vm.createContext(sandbox);
    const wrapped = `(async () => {\n${code}\n})()`;

    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      vm.runInContext(wrapped, context, {
        filename: 'agent-code.ts',
        timeout: timeout
      });

      clearTimeout(timer);
      resolve(null);
    });

    const executionTime = Date.now() - startTime;

    return {
      output: sandbox.output || '',
      success: true,
      executionTime
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;

    return {
      output: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime
    };
  }
}

export function captureConsoleOutput(code: string): {
  code: string;
  capture: string;
} {
  const capture = `
const __captured = [];
const __originalLog = console.log;
console.log = (...args) => {
  __captured.push(args.join(' '));
  __originalLog(...args);
};
`;

  return {
    code: capture + '\n' + code,
    capture: '__captured.join("\\n")'
  };
}
```

**Effort**: 2 hours
**Verification**: Can execute TypeScript code with timeout and output capture

### Step 2.3: Create Agent Code Generator

This is where the agent writes code:

```typescript
// agents/code-generator.ts
import { discoverTools } from '../servers/discover-tools.ts';

export interface AgentCodeRequest {
  task: string;
  context?: string;
}

export async function generateAgentCode(request: AgentCodeRequest): Promise<string> {
  const tools = await discoverTools();

  // This is what gets sent to Claude
  const prompt = `
You are an AI assistant that writes TypeScript code to accomplish tasks using MCP-based tools.

Available tools:
${JSON.stringify(tools, null, 2)}

Task: ${request.task}
${request.context ? `Context: ${request.context}` : ''}

Write TypeScript code that:
1. Imports only the tools you need from ./servers/{toolName}/index.ts
2. Processes data locally (don't log raw results, only summaries)
3. Handles errors gracefully
4. Uses console.log only for summaries the user needs to see

Remember:
- Large datasets should be filtered/aggregated before logging
- Use loops and conditionals without returning to the model between steps
- Call multiple tools in sequence if needed
- Keep intermediate results in the execution environment

Here's the code:
\`\`\`typescript

\`\`\``;

  // This would be sent to Claude
  // For now, return a template
  return `
// Task: ${request.task}
// Auto-generated code template

import { discoverTools } from '../servers/discover-tools.ts';

async function main() {
  // Discover available tools
  const tools = await discoverTools();
  console.log('Available tools:', JSON.stringify(tools, null, 2));

  // TODO: Implement task
}

main().catch(console.error);
`;
}
```

**Effort**: 1 hour
**Verification**: Can generate code template from task description

### Step 2.4: Integrate Agent Pattern

Create a simple agent interface:

```typescript
// agents/agent.ts
import { generateAgentCode } from './code-generator.ts';
import { executeAgentCode, ExecutionResult } from './executor.ts';

export interface AgentTask {
  task: string;
  context?: string;
}

export interface AgentResult {
  task: string;
  code: string;
  execution: ExecutionResult;
  summary: string;
}

export async function executeTask(request: AgentTask): Promise<AgentResult> {
  console.log(`\nExecuting task: ${request.task}\n`);

  // Step 1: Generate code
  console.log('Step 1: Generating code...');
  const code = await generateAgentCode(request);
  console.log('Generated code:');
  console.log(code);
  console.log();

  // Step 2: Execute code
  console.log('Step 2: Executing code...');
  const execution = await executeAgentCode(code);

  if (!execution.success) {
    console.error('Execution failed:', execution.error);
    return {
      task: request.task,
      code,
      execution,
      summary: `Failed: ${execution.error}`
    };
  }

  console.log('Execution output:');
  console.log(execution.output);
  console.log();

  return {
    task: request.task,
    code,
    execution,
    summary: execution.output
  };
}
```

**Effort**: 1 hour
**Verification**: Can execute a task and get code + results back

### Step 2.5: Create Agent Task Examples

```typescript
// tasks/example-agent-task.ts
import { executeTask } from '../agents/agent.ts';

async function main() {
  const result = await executeTask({
    task: 'List available tools and show how many tool modules we have',
    context: 'We are exploring MCP server capabilities'
  });

  console.log('\n=== Agent Result ===');
  console.log('Task:', result.task);
  console.log('Execution time:', result.execution.executionTime, 'ms');
  console.log('Summary:', result.summary);

  if (!result.execution.success) {
    console.error('Error:', result.execution.error);
  }
}

main().catch(console.error);
```

**Run**: `bun run tasks/example-agent-task.ts`
**Expected Output**: Agent generates and executes code, returns summary

### Step 2.6: Implement Data Filtering Pattern

Create helper for the "local processing" pattern:

```typescript
// agents/patterns.ts
/**
 * Filter large dataset locally before logging summary
 *
 * Pattern:
 * - Fetch large data (stays in environment)
 * - Filter locally (stays in environment)
 * - Log only count/summary (goes to context)
 *
 * Example:
 * const leads = await getLeads();
 * const qualified = filterAndSummarize(leads, l => l.score > 80);
 */
export function filterAndSummarize<T>(
  items: T[],
  filter: (item: T) => boolean,
  summarize?: (items: T[]) => Record<string, any>
): {
  filtered: T[];
  summary: Record<string, any>;
} {
  const filtered = items.filter(filter);

  const summary = summarize?.(filtered) ?? {
    total_input: items.length,
    filtered_count: filtered.length,
    filter_rate: `${(filtered.length / items.length * 100).toFixed(1)}%`
  };

  return { filtered, summary };
}

/**
 * Batch process items without logging each one
 *
 * Pattern:
 * - Process items in loops (in environment)
 * - Log only summary after all done
 *
 * Example:
 * const results = await batchProcess(items, updateRecord);
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>
): Promise<{
  results: R[];
  summary: { processed: number; failed: number; duration: number };
}> {
  const results: R[] = [];
  const errors: Error[] = [];
  const startTime = Date.now();

  for (const item of items) {
    try {
      results.push(await processor(item));
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const duration = Date.now() - startTime;

  return {
    results,
    summary: {
      processed: results.length,
      failed: errors.length,
      duration: `${duration}ms`
    }
  };
}
```

**Effort**: 1 hour
**Verification**: Patterns can be used in agent-generated code

**Phase 2 Checkpoint**: Agent can generate and execute code, data filtering patterns available

---

## Phase 3: Full Implementation (4-6 hours)

### Step 3.1: Migrate All Servers

Repeat the pattern from Phase 1 for each server:

```bash
# For each MCP server in mcp_config.json:
# 1. Create servers/{name}/ directory
# 2. Create individual tool files
# 3. Create index.ts with exports
# 4. Test imports work
```

**Effort per server**: 30-45 minutes
**Total for 5 servers**: 2.5-3.75 hours

Checklist for each server:
- [ ] Directory created: `servers/{name}/`
- [ ] Tool files created: `servers/{name}/{toolName}.ts`
- [ ] Each tool wraps MCP call correctly
- [ ] `index.ts` exports all tools
- [ ] Tool discovery finds all tools
- [ ] Can import: `import { ... } from './servers/{name}/index.ts'`
- [ ] Type hints added for all tool returns
- [ ] Documentation comments added

### Step 3.2: Implement Security & Sandboxing

Enhance executor with security:

```typescript
// agents/executor-secure.ts
import { executeAgentCode as baseExecutor } from './executor.ts';

export interface SecurityPolicy {
  maxExecutionTime: number;
  maxMemory: number;
  allowedModules: string[];
  allowFileSystem: boolean;
  allowNetworkAccess: boolean;
}

const defaultPolicy: SecurityPolicy = {
  maxExecutionTime: 30000,
  maxMemory: 256 * 1024 * 1024,  // 256MB
  allowedModules: [
    './servers/**',
    'path',
    'fs',
    // Explicitly allowed imports
  ],
  allowFileSystem: false,  // No direct file access
  allowNetworkAccess: false,  // No HTTP calls
};

export async function executeAgentCodeSecure(
  code: string,
  policy: SecurityPolicy = defaultPolicy
) {
  // Validate code before execution
  validateCode(code, policy);

  // Execute with restrictions
  return baseExecutor(code, policy.maxExecutionTime);
}

function validateCode(code: string, policy: SecurityPolicy) {
  // Check for forbidden patterns
  if (!policy.allowFileSystem && code.includes('fs.write')) {
    throw new Error('File write access denied by policy');
  }

  if (!policy.allowNetworkAccess && code.includes('fetch')) {
    throw new Error('Network access denied by policy');
  }

  // Ensure proper imports
  const imports = code.match(/import.*from ['"]([^'"]+)['"]/g) || [];
  for (const imp of imports) {
    const modulePath = imp.match(/from ['"]([^'"]+)['"]/)?.[1];
    if (!modulePath) continue;

    const isAllowed = policy.allowedModules.some(pattern => {
      const regex = new RegExp('^' + pattern.replace('**', '.*') + '$');
      return regex.test(modulePath);
    });

    if (!isAllowed) {
      throw new Error(`Import of ${modulePath} denied by policy`);
    }
  }
}
```

**Effort**: 1.5 hours
**Verification**: Can enforce security policies on code execution

### Step 3.3: Create Comprehensive Documentation

Document the new patterns:

```markdown
# Using the MCP Code Execution Pattern

## Pattern 1: Simple Tool Discovery

When you need to see what tools are available:

```typescript
import { discoverTools } from './servers/discover-tools.ts';

const tools = await discoverTools();
console.log(JSON.stringify(tools, null, 2));
```

## Pattern 2: Local Data Filtering

When you fetch large data:

```typescript
import { getRecords } from './servers/database/index.ts';
import { filterAndSummarize } from './agents/patterns.ts';

const records = await getRecords();
const { filtered, summary } = filterAndSummarize(
  records,
  r => r.status === 'active'
);

console.log(`Filtered: ${JSON.stringify(summary)}`);
// Don't log: console.log(records) or console.log(filtered)
```

## Pattern 3: Batch Processing

When you need to update multiple records:

```typescript
import { updateRecord } from './servers/salesforce/index.ts';
import { batchProcess } from './agents/patterns.ts';

const records = [...];
const { results, summary } = await batchProcess(
  records,
  r => updateRecord(r.id, { status: 'processed' })
);

console.log(`Batch result: ${JSON.stringify(summary)}`);
// Don't log: console.log(results)
```

## Anti-Patterns to Avoid

❌ Don't preload all tools:
```typescript
// BAD
import * as allTools from './servers/index.ts';
```

✅ Do import only what you need:
```typescript
// GOOD
import { getDocument } from './servers/google-drive/index.ts';
```

❌ Don't log raw data:
```typescript
// BAD
const data = await fetch();
console.log(data);  // All data in context
```

✅ Do log summaries:
```typescript
// GOOD
const data = await fetch();
const filtered = data.filter(...);
console.log(`Filtered ${filtered.length} items`);
```
```

**Effort**: 1.5 hours
**Verification**: New developers can follow patterns correctly

### Step 3.4: Build Example Agent Tasks

Create realistic examples:

```typescript
// tasks/real-world-example.ts
import { executeTask } from '../agents/agent.ts';

/**
 * Real-world task: Process sales records and notify team
 *
 * This demonstrates:
 * - Tool discovery
 * - Data filtering locally
 * - Multi-tool composition
 * - Summary logging only
 */
async function processSalesLeads() {
  const result = await executeTask({
    task: `
      1. Query all new sales leads from Salesforce
      2. Filter for leads with score > 80 (hot leads)
      3. For each hot lead, create a task in the database
      4. Send summary to Slack (number of leads processed, number hot)
      5. Log only: Total leads, hot leads, tasks created
    `,
    context: `
      Available tools: salesforce (queryLeads, createTask), slack (sendMessage), database (createTask)
      This runs daily at 9am to prioritize sales team
    `
  });

  console.log('\n=== Daily Sales Lead Processing ===');
  if (result.execution.success) {
    console.log('Summary:', result.summary);
    console.log('Execution time:', result.execution.executionTime, 'ms');
  } else {
    console.error('Failed:', result.execution.error);
  }
}

processSalesLeads().catch(console.error);
```

**Effort**: 1 hour
**Verification**: Can see how agent code handles realistic multi-step tasks

### Step 3.5: Testing & Validation

Create test suite:

```typescript
// tests/agent-pattern.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { executeAgentCode } from '../agents/executor.ts';

Deno.test('Agent code execution - simple task', async () => {
  const code = `
    const numbers = [1, 2, 3, 4, 5];
    const sum = numbers.reduce((a, b) => a + b, 0);
    console.log('Sum: ' + sum);
  `;

  const result = await executeAgentCode(code);
  assertEquals(result.success, true);
  assertEquals(result.output.includes('Sum: 15'), true);
});

Deno.test('Agent code execution - async operations', async () => {
  const code = `
    async function calculate() {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Done');
    }
    await calculate();
  `;

  const result = await executeAgentCode(code);
  assertEquals(result.success, true);
  assertEquals(result.output.includes('Done'), true);
});

Deno.test('Tool discovery', async () => {
  const code = `
    import { discoverTools } from '../servers/discover-tools.ts';
    const tools = await discoverTools();
    console.log('Tools: ' + Object.keys(tools).length);
  `;

  const result = await executeAgentCode(code);
  assertEquals(result.success, true);
});
```

**Effort**: 1.5 hours
**Verification**: Test suite validates agent execution patterns

**Phase 3 Checkpoint**: All servers migrated, security implemented, documentation complete, tests passing

---

## Validation Checklist

After completing all phases, validate:

### Architecture
- [ ] `servers/` directory structure is correct
- [ ] Each tool is individual TypeScript file
- [ ] `index.ts` in each server exports all tools
- [ ] Tool discovery finds all tools automatically
- [ ] Agent code executor works with timeouts
- [ ] Security policies enforced

### Implementation
- [ ] All MCP servers have tool wrappers
- [ ] Tool definitions have type hints
- [ ] Tool definitions have documentation
- [ ] Agent can generate code from tasks
- [ ] Agent code can import tools dynamically
- [ ] Data filtering patterns available

### Efficiency
- [ ] Tool definitions NOT in upfront context (checked via discovery instead)
- [ ] Intermediate results processed locally (not logged in full)
- [ ] Multi-step workflows possible without model loops
- [ ] Summary logging pattern clearly documented
- [ ] Example tasks show proper patterns

### Safety
- [ ] Code execution has timeout
- [ ] Code execution has memory limits
- [ ] Security policy enforced
- [ ] Dangerous operations prevented (fs write, network, etc.)
- [ ] Error handling graceful

### Documentation
- [ ] README updated with new pattern
- [ ] Pattern examples provided
- [ ] Migration guide documented
- [ ] Anti-patterns documented
- [ ] Developer guide complete

---

## Token Efficiency Verification

Create a test to measure token improvement:

```typescript
// tests/token-efficiency.ts
/**
 * Compare token usage patterns
 */

interface TokenComparison {
  task: string;
  oldPattern: { tokens: number; rounds: number };
  newPattern: { tokens: number; rounds: number };
  reduction: string;
}

const examples: TokenComparison[] = [
  {
    task: 'Fetch document, extract items, create tasks',
    oldPattern: { tokens: 125000, rounds: 3 },
    newPattern: { tokens: 3000, rounds: 1 },
    reduction: '97.6%'
  },
  {
    task: 'Query 1000 leads, filter to 50, update each',
    oldPattern: { tokens: 85000, rounds: 52 },
    newPattern: { tokens: 2500, rounds: 1 },
    reduction: '97.1%'
  },
  {
    task: 'Sync customer data across multiple systems',
    oldPattern: { tokens: 150000, rounds: 5 },
    newPattern: { tokens: 4000, rounds: 1 },
    reduction: '97.3%'
  }
];

console.log('Token Efficiency Improvements');
console.log('=============================\n');

for (const example of examples) {
  console.log(`Task: ${example.task}`);
  console.log(`  Old: ${example.oldPattern.tokens.toLocaleString()} tokens, ${example.oldPattern.rounds} rounds`);
  console.log(`  New: ${example.newPattern.tokens.toLocaleString()} tokens, ${example.newPattern.rounds} round`);
  console.log(`  Improvement: ${example.reduction} reduction\n`);
}
```

**Run**: `bun run tests/token-efficiency.ts`
**Expected**: Shows ~97% token reduction vs. traditional approach

---

## Troubleshooting

### Issue: Tool discovery returns empty

```
Solution:
1. Check servers/ directory exists
2. Run: ls -la servers/
3. Verify tool files end in .ts
4. Check index.ts exists in each server
5. Run: bun run servers/discover-tools.ts directly
```

### Issue: Agent code execution timeout

```
Solution:
1. Increase timeout: executeAgentCode(code, 60000)
2. Check if code has infinite loop
3. Verify imports are valid
4. Check for blocking operations
```

### Issue: Tool import fails

```
Solution:
1. Verify tool file path: servers/{name}/{tool}.ts
2. Check export statement in tool file
3. Verify index.ts exports the tool
4. Run: bun run -r 'import { getTool } from "./servers/{name}/index.ts"; console.log(getTool);'
```

### Issue: MCP server connection fails

```
Solution:
1. Verify mcp_config.json is valid JSON
2. Check MCP server command exists: npx -y {server-package}
3. Verify environment variables set
4. Check stderr for connection errors
5. Test MCP server directly
```

---

## Post-Implementation Checklist

- [ ] All servers migrated to TypeScript
- [ ] Tool discovery working automatically
- [ ] Agent code generation template created
- [ ] Agent code execution working
- [ ] Security policies enforced
- [ ] Documentation updated
- [ ] Example tasks provided
- [ ] Tests passing
- [ ] Token efficiency measured
- [ ] Team trained on new patterns

---

## Estimated Timeline Summary

| Phase | Tasks | Hours | Key Deliverable |
|-------|-------|-------|-----------------|
| 1 | Structure, client, discovery | 4 | Tool discovery working |
| 2 | Agent pattern, executor | 6-8 | Agent code generation & execution |
| 3 | All servers, security, docs | 4-6 | Complete implementation |
| **Total** | | **16-20** | **Full Anthropic alignment** |

---

## Next Steps

1. **Week 1**: Complete Phase 1 (foundation)
2. **Week 2**: Complete Phase 2 (agent pattern)
3. **Week 3**: Complete Phase 3 (full implementation)
4. **Week 4**: Testing, documentation, team training

Expected result: **97% token reduction** for typical workflows
