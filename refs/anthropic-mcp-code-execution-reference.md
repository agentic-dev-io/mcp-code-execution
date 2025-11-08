# Anthropic's MCP Code Execution Architecture - Reference Guide

**Last Updated**: 2025-11-08
**Source**: Anthropic Engineering Blog & Official Documentation
**Status**: ✅ Current (Published November 2025)
**Official Source**: https://www.anthropic.com/engineering/code-execution-with-mcp

---

## Executive Summary

Anthropic's official "Code Execution with MCP" pattern represents a fundamental paradigm shift in how AI agents interact with external tools and data sources. Rather than agents making direct tool calls through the MCP protocol, **agents write and execute code that uses MCP servers as code-level APIs accessed through a filesystem**.

This architecture achieves **98.7% token reduction** (from 150,000 to 2,000 tokens in benchmark scenarios) through three core mechanisms:

1. **Progressive tool discovery** - Tool definitions loaded on-demand, not preloaded
2. **Local data processing** - Intermediate results stay in execution environment
3. **Direct code integration** - Tools become composable code modules, not protocol calls

---

## Core Architecture Pattern

### The Problem: Traditional Tool Calling

In traditional MCP tool calling architectures:

```
Model Context
├── Tool definition 1 (500 tokens)
├── Tool definition 2 (500 tokens)
├── ...many more (150k+ total)
└── Intermediate result from Tool 1 (50k tokens)
    └── Passed back through model
        └── Passed to Tool 2 call again
```

**Issues:**
- All tool definitions loaded upfront (150k+ tokens even if only 1-2 needed)
- Intermediate results flow through model context multiple times
- Long documents passed through model even when only used as intermediaries
- Context bloat increases cost, latency, and error rates
- Sensitive data unnecessarily exposed to model

### The Solution: Code Execution Pattern

```
Execution Environment
├── servers/ (filesystem)
│   ├── google-drive/
│   │   ├── getDocument.ts (loaded only when needed)
│   │   └── index.ts
│   └── salesforce/
│       ├── updateRecord.ts (loaded only when needed)
│       └── index.ts
│
├── Data Processing (local, not in context)
│   ├── Read document from gdrive
│   ├── Filter/transform locally
│   └── Pass only summary to model
│
└── Code Execution (agent writes)
    └── Import needed tools, execute, capture results
```

**Benefits:**
- Tool definitions accessed on-demand via filesystem exploration
- Intermediate results processed locally in execution environment
- Data never flows through model unless explicitly logged
- Sensitive data isolation (encryption mappings maintained server-side)
- Single code module can chain multiple tools without model intervention

---

## How It Works: The Architecture in Detail

### 1. Tool Exposure as Filesystem Code Modules

Instead of exposing MCP tools through the MCP protocol, servers are exposed as TypeScript code modules on a filesystem:

```
servers/
├── google-drive/
│   ├── __init__.ts (or index.ts)
│   ├── getDocument.ts
│   ├── listFiles.ts
│   ├── createFolder.ts
│   └── uploadFile.ts
├── salesforce/
│   ├── __init__.ts
│   ├── queryRecords.ts
│   ├── updateRecord.ts
│   ├── createLead.ts
│   └── deleteRecord.ts
└── github/
    ├── __init__.ts
    ├── getRepository.ts
    ├── createIssue.ts
    └── getCommits.ts
```

Each tool file is a **self-contained code module** with:
- Clear function signature
- Input validation
- MCP client call wrapped in code
- Type hints
- Documentation comments

**Example Tool Module:**

```typescript
// servers/google-drive/getDocument.ts
import { callMCPTool } from '../client.ts';

/**
 * Fetch a document from Google Drive by ID.
 *
 * @param documentId - The Google Drive document ID
 * @returns Object with content, metadata, and formatting
 */
export async function getDocument(documentId: string): Promise<{
  id: string;
  title: string;
  content: string;
  mimeType: string;
  modifiedTime: string;
}> {
  return await callMCPTool('google-drive', 'getDocument', {
    document_id: documentId,
  });
}
```

### 2. Progressive Tool Discovery

Rather than loading all tool definitions into context, agents **discover tools on demand**:

```
Agent Workflow:
1. List available servers: fs.readdir('servers/')
   └── Returns: ['google-drive', 'salesforce', 'github', ...]
   └── Cost: 0 tokens (code execution)

2. If Google Drive needed, list available tools: fs.readdir('servers/google-drive/')
   └── Returns: ['getDocument', 'listFiles', 'uploadFile', ...]
   └── Cost: 0 tokens (code execution)

3. Read specific tool definition only when needed: fs.readFile('servers/google-drive/getDocument.ts')
   └── Returns: Full TypeScript function with types and docs
   └── Cost: ~200 tokens (only for this one tool)

4. Execute code that imports and calls the tool
   └── Other 100 tools never loaded
   └── Savings: ~100k tokens
```

**Key Insight**: Tool catalogs shift from **model context** to **filesystem structure**. The model sees the directory structure naturally through code, not through verbose JSON descriptions.

### 3. Local Data Processing & Filtering

Intermediate results stay in the execution environment by default:

```typescript
// Agent-written code in execution environment
import { getDocument } from './servers/google-drive/index.ts';
import { updateRecord } from './servers/salesforce/index.ts';

async function main() {
  // Step 1: Get large document (50k tokens if passed through context)
  const doc = await getDocument('doc-id-123');

  // Step 2: Process LOCALLY - not in model context
  const lines = doc.content.split('\n');
  const actionItems = lines
    .filter(line => line.startsWith('ACTION:'))
    .map(line => line.replace('ACTION:', '').trim());

  // Step 3: Return only summary to model for decision
  console.log(`Extracted ${actionItems.length} action items from document`);

  // Step 4: Model decides what to do with actionItems
  // Only the filtered list goes into context, not the full 50k token document

  // Step 5: Update Salesforce with processed data
  await updateRecord('salesforce-id', {
    actions: actionItems,
    processed_at: new Date().toISOString()
  });
}
```

**Token Savings Breakdown**:
- Without local processing: Document (50k) → Model → Salesforce call (50k) = 100k tokens
- With local processing: Document processed locally → Summary (500 tokens) → Salesforce call = 500 tokens
- **Savings: 99.5% for this step**

### 4. Agent Code Execution Pattern

The agent writes code that composes tools together, rather than calling them through protocol:

```typescript
// What the agent writes (not what it calls through MCP)
import {
  queryRecords,
  updateRecord
} from './servers/salesforce/index.ts';

async function syncOpportunitiesByStage(stage: string) {
  // Agent decides the logic, not predefined actions
  const opportunities = await queryRecords({
    type: 'Opportunity',
    where: { StageName: stage },
    limit: 1000
  });

  // Process in environment
  const updated = opportunities
    .filter(opp => opp.Amount > 50000)
    .map(opp => ({
      ...opp,
      LastReviewDate: new Date().toISOString()
    }));

  // Update all matching records (no round-trips through model)
  for (const record of updated) {
    await updateRecord(record.Id, record);
  }

  console.log(`Updated ${updated.length} opportunities`);
}

await syncOpportunitiesByStage('Proposal');
```

The agent writes code like a developer would, not selecting from predefined actions. This enables:
- Loops without repeated model calls
- Conditionals based on data
- Complex multi-step workflows
- Direct tool composition

---

## Context Flow Comparison

### Traditional Tool Calling Model

```
User Intent
    ↓
Model decides action
    ↓
Tool definition (in context): 500 tokens
    ↓
Model calls tool
    ↓
Result returned: potentially 50k+ tokens
    ↓
Result in context
    ↓
Model decides next action
    ↓
Next tool definition (in context): 500 tokens
    ↓
Model calls tool
    ↓
[REPEAT - data flows back through model each time]
    ↓
Final response: 1-5k tokens

TOTAL: 150k+ tokens for task with multiple tools and large data
```

### Code Execution with MCP Model

```
User Intent
    ↓
Model writes code to:
  - Discover needed tools
  - Execute tools in sequence
  - Filter results locally
  - Handle control flow
    ↓
Code Execution Environment:
  ├─ Read servers/ filesystem (0 tokens)
  ├─ Load only needed tool modules (200 tokens)
  ├─ Execute tools with actual values (0 tokens in context)
  ├─ Process data locally (0 tokens in context)
  └─ Keep sensitive data isolated (encrypted mapping)
    ↓
Model sees only:
  - Code it wrote (2k tokens)
  - Filtered summary results (500 tokens)
  - Any explicit logging (0-1k tokens)
    ↓
Final response: 1-5k tokens

TOTAL: 2-5k tokens for same task (98%+ reduction)
```

---

## Key Architectural Principles

### 1. Progressive Disclosure

**Principle**: Don't load information into context until needed.

```typescript
// GOOD: Progressive disclosure
// Agent explores filesystem structure naturally
const servers = fs.readdirSync('servers/');
if (servers.includes('google-drive')) {
  const tools = fs.readdirSync('servers/google-drive/');
  if (tools.includes('getDocument')) {
    const { getDocument } = await import('./servers/google-drive/getDocument.ts');
    // Now use getDocument
  }
}
// Only loaded definitions the agent actually uses

// AVOID: Preloading all definitions
// [All 150+ tool definitions in system prompt]
// [All descriptions in context before use]
```

**Benefit**: Model only pays attention cost for tools it actually needs.

### 2. In-Environment Processing

**Principle**: Process large datasets where they live (execution environment), not where they're consumed (model context).

```typescript
// GOOD: Process locally
const doc = await getDocument(docId);
const summary = extractSummary(doc.content);  // Local processing
console.log(`Document has ${summary.sections} sections`);
// Model sees: "Document has 12 sections" (50 tokens)

// AVOID: Pass through model
console.log(doc.content);  // 50k token document in context
// Model sees: entire document (50k+ tokens)
```

**Benefit**: Data stays in environment, only summaries/metadata go to model.

### 3. Direct Tool Composition

**Principle**: Tools can call other tools directly, bypassing the model.

```typescript
// GOOD: Direct tool composition
import { getDocument } from './servers/google-drive/index.ts';
import { createIssue } from './servers/github/index.ts';

const doc = await getDocument('meeting-notes-id');
const issues = extractIssuesFromNotes(doc.content);

for (const issue of issues) {
  // Tools call each other directly, model not involved
  await createIssue(issue.title, issue.description);
}

// AVOID: Tool results flowing through model
// Tool 1 returns result
// Model decides what to do
// Tool 2 is called
// [This repeats for each step]
```

**Benefit**: Multi-step workflows execute at machine speed, not model round-trip speed.

### 4. Data Isolation & Privacy

**Principle**: Sensitive data stays in execution environment; only sanitized results flow to model.

```typescript
// GOOD: Data isolation
import { queryCustomers } from './servers/crm/index.ts';

const customers = await queryCustomers({ status: 'active' });

// Sensitive data stays in environment
const customerEmails = customers.map(c => c.email);  // Never logged
const aggregatedMetrics = {
  total: customers.length,
  avgValue: Math.sum(...customers.map(c => c.lifetime_value)) / customers.length
};

console.log(`Processed ${aggregatedMetrics.total} customers`);
console.log(`Average customer value: $${aggregatedMetrics.avgValue}`);

// Model sees: metrics, not raw customer data

// AVOID: Sensitive data in context
console.log(JSON.stringify(customers));
// Exposes all email addresses, revenue data, etc.
```

**Benefit**: Privacy maintained through architecture, not promises.

### 5. Explicit Logging for Context

**Principle**: Only consciously logged output becomes context; implicit side effects stay local.

```typescript
// GOOD: Explicit logging
const customers = await queryCustomers();
customers.forEach(c => updateLastSeen(c.id));  // No logging = no tokens
console.log(`Updated ${customers.length} customers`);  // Explicit = model sees

// AVOID: Implicit exposure
console.log(customers);  // All customer data flows to context
```

**Benefit**: Clear contract about what the model sees vs. what stays local.

---

## Practical Implementation Pattern

### Step 1: Expose MCP Servers as Code Modules

Convert each MCP server into filesystem-based code modules:

```
mcp_config.json defines server connections
          ↓
setup script generates servers/ directory structure
          ↓
servers/
├── {server_name}/
│   ├── __init__.ts (exports all tools)
│   └── {tool_name}.ts (wraps MCP client call)
```

**Example wrapper:**

```typescript
// servers/slack/sendMessage.ts
import { callMCPTool } from '../../client.ts';

export async function sendMessage(
  channel: string,
  message: string,
  options?: { thread_ts?: string; reply_broadcast?: boolean }
): Promise<{ ok: boolean; ts: string; channel: string }> {
  return await callMCPTool('slack', 'send_message', {
    channel,
    text: message,
    ...options,
  });
}
```

### Step 2: Agent Discovers Tools Dynamically

Agent code reads filesystem to understand available capabilities:

```typescript
// Agent-generated code
import fs from 'fs';
import path from 'path';

async function discoverServers() {
  const serversDir = path.join(process.cwd(), 'servers');
  const servers = fs.readdirSync(serversDir);

  return servers.map(server => ({
    name: server,
    tools: fs.readdirSync(path.join(serversDir, server))
      .filter(f => f.endsWith('.ts') && f !== '__init__.ts')
      .map(f => f.replace('.ts', ''))
  }));
}

const available = await discoverServers();
console.log('Available servers and tools:');
console.log(JSON.stringify(available, null, 2));

// Model uses this to decide what to do
```

### Step 3: Agent Writes Code Using Discovered Tools

```typescript
// Based on available tools, agent writes:
import { sendMessage } from './servers/slack/index.ts';
import { queryIssues } from './servers/github/index.ts';

async function notifyTeamOfIssues() {
  const issues = await queryIssues({ status: 'open', priority: 'high' });

  for (const issue of issues) {
    const message = `🚨 High priority issue: ${issue.title}\n${issue.url}`;
    await sendMessage('engineering', message);
  }

  console.log(`Notified team of ${issues.length} issues`);
}

await notifyTeamOfIssues();
```

### Step 4: Results Returned to Model as Summary

Only the summary goes back to model context:

```
[From code execution]
Notified team of 3 issues

[In context: ~100 tokens]
```

---

## Best Practices & Patterns

### Pattern: Data Filtering with Summary

**Situation**: Need to fetch large dataset, filter it, act on subset.

```typescript
// GOOD: Process locally, summary to model
import { queryLeads } from './servers/salesforce/index.ts';
import { sendEmail } from './servers/email/index.ts';

const leads = await queryLeads({ status: 'hot' });  // Could be 10k rows

// Filter locally
const qualified = leads
  .filter(l => l.score > 80)
  .filter(l => l.industry === 'tech');

// Send outreach (tool composition)
for (const lead of qualified) {
  await sendEmail(lead.email, generateOutreach(lead));
}

// Summary to model
const summary = {
  total_leads_checked: leads.length,
  qualified_leads: qualified.length,
  emails_sent: qualified.length,
  outreach_rate: (qualified.length / leads.length * 100).toFixed(1) + '%'
};
console.log(JSON.stringify(summary));

// Model context: ~200 tokens (summary)
// Without optimization: ~150k tokens (all leads data)
```

### Pattern: Multi-Step Workflow Without Model Loops

**Situation**: Complex workflow with conditionals and loops.

```typescript
// GOOD: Complete workflow in one code execution
import { getRepository } from './servers/github/index.ts';
import { createTicket } from './servers/jira/index.ts';
import { notifyChannel } from './servers/slack/index.ts';

async function auditOpenIssues() {
  const repo = await getRepository('myorg/myrepo');
  const openIssues = repo.issues.filter(i => i.state === 'open');

  const tickets = [];

  for (const issue of openIssues) {
    // Multi-step logic without model intervention
    if (issue.labels.includes('bug') && !issue.assignee) {
      const ticket = await createTicket({
        summary: issue.title,
        description: issue.body,
        priority: 'high',
        external_id: issue.id
      });
      tickets.push(ticket);
    }
  }

  // Notify once with summary
  if (tickets.length > 0) {
    await notifyChannel('security',
      `Created ${tickets.length} tickets for unassigned bugs`);
  }

  console.log(`Processed ${openIssues.length} issues, created ${tickets.length} tickets`);
}

await auditOpenIssues();

// Model involvement: 0 times
// Model context: ~500 tokens (the code + summary)
// Without optimization: 5+ round trips through model per issue
```

### Pattern: Error Handling & Fallbacks

**Situation**: Need to handle failures gracefully.

```typescript
// GOOD: Error handling in execution environment
import { queryDatabase } from './servers/postgres/index.ts';
import { logEvent } from './servers/datadog/index.ts';

async function syncData() {
  try {
    const data = await queryDatabase('SELECT * FROM users LIMIT 1000');

    if (!data || data.length === 0) {
      console.log('No data to sync');
      return;
    }

    // Process data
    const processed = data.map(applyTransform);

    // Log success
    await logEvent({
      event: 'data_sync_success',
      count: processed.length,
      timestamp: new Date().toISOString()
    });

    console.log(`Synced ${processed.length} records`);

  } catch (error) {
    // Handle error locally
    console.error(`Sync failed: ${error.message}`);

    // Notify about failure
    await logEvent({
      event: 'data_sync_failure',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Model sees: outcome summary
    console.log('Sync operation failed, error logged');
  }
}

await syncData();

// All error handling in code, not model fallback
// Model sees: success or failure summary (100 tokens)
// Without optimization: Model would need to see errors, decide fallback (5k+ tokens)
```

### Pattern: Sensitive Data Handling

**Situation**: Process data containing sensitive information.

```typescript
// GOOD: Sensitive data isolation
import { queryPayments } from './servers/stripe/index.ts';
import { createReport } from './servers/analytics/index.ts';

async function generatePaymentAnalytics() {
  // Fetch sensitive data
  const payments = await queryPayments({ month: 'october' });

  // Process locally, never log raw data
  const metrics = {
    total_transactions: payments.length,
    total_revenue: payments.reduce((sum, p) => sum + p.amount, 0),
    average_transaction: 0,
    largest_transaction: 0,
    payment_methods: {}
  };

  // Calculate metrics WITHOUT exposing card numbers, customer names, etc.
  metrics.average_transaction = metrics.total_revenue / metrics.total_transactions;
  metrics.largest_transaction = Math.max(...payments.map(p => p.amount));

  // Count payment methods without storing card details
  payments.forEach(p => {
    metrics.payment_methods[p.method] = (metrics.payment_methods[p.method] || 0) + 1;
  });

  // Send metrics to analytics (aggregated, no PII)
  await createReport({
    report_type: 'payment_metrics',
    data: metrics,
    generated_at: new Date().toISOString()
  });

  // Log summary
  console.log(`Processed ${metrics.total_transactions} payments`);
  console.log(`Total revenue: $${metrics.total_revenue}`);

  // Model sees: summary only
  // Sensitive data: never left the execution environment
  // No encryption mapping needed (data never exposed)
}

await generatePaymentAnalytics();
```

---

## Common Mistakes to Avoid

### Mistake 1: Preloading All Tool Definitions

```typescript
// BAD: Context bloat
import * as googleDrive from './servers/google-drive/index.ts';
import * as salesforce from './servers/salesforce/index.ts';
import * as slack from './servers/slack/index.ts';
import * as github from './servers/github/index.ts';
// ... 20 more imports

// All tool definitions now in context before using any (150k+ tokens)

// GOOD: On-demand imports
const toolName = 'google-drive'; // Determined dynamically
const tool = await import(`./servers/${toolName}/index.ts`);
// Only loads what's needed
```

### Mistake 2: Passing Large Results Through Model

```typescript
// BAD: Large data in context
const document = await getDocument(docId);
console.log(document);  // All 50k tokens flow to context

// GOOD: Filter and summarize locally
const document = await getDocument(docId);
const summary = {
  length: document.content.length,
  sections: document.content.split('\n\n').length,
  hasImages: document.content.includes('<img'),
  keywords: extractKeywords(document.content)
};
console.log(JSON.stringify(summary));  // ~500 tokens
```

### Mistake 3: Tool-to-Tool Through Model

```typescript
// BAD: Results flow through model
const leads = await queryLeads();
console.log(leads);  // Returns to model
// Model sees leads and decides what to do
const updated = await updateLeads(selectedLeads);
console.log(updated);  // Returns to model

// GOOD: Direct tool composition
const leads = await queryLeads();
const qualified = leads.filter(l => l.score > 80);
for (const lead of qualified) {
  await updateLead(lead.id, { status: 'contacted' });
}
console.log(`Updated ${qualified.length} leads`);  // Summary only
```

### Mistake 4: Verbose Logging

```typescript
// BAD: Each step logged in detail
const customers = await getCustomers();
console.log('Customers retrieved:');
console.log(JSON.stringify(customers, null, 2));  // Each customer = tokens

const updated = customers.map(updateCredit);
console.log('Updated customers:');
console.log(JSON.stringify(updated, null, 2));  // Each customer = tokens again

// GOOD: Summary logging
const customers = await getCustomers();
const updated = customers.map(updateCredit);
console.log(`Updated ${updated.length} customers; ${updated.filter(u => u.credit > 0).length} now have credit`);
```

---

## Comparison: Current Implementation vs. Anthropic Recommended

### Current Implementation Issues

**Current CLAUDE.md Pattern:**
```python
# Current approach
from servers.python.google_drive import get_document
from servers.python.salesforce import query

doc = await get_document(document_id='abc123')
results = await query(soql="SELECT ...")

# Issue 1: Full imports at module level
# Issue 2: Results flow back through context
# Issue 3: No on-demand tool discovery pattern
# Issue 4: No encryption mapping for sensitive data
```

**Problems:**
1. ❌ Tools imported at module level (upfront loading)
2. ❌ No filesystem directory structure to explore
3. ❌ No pattern for progressive discovery
4. ❌ Large intermediate results flow through context
5. ❌ No pattern for local filtering before logging
6. ❌ Treats code execution as simple wrapper, not as agent code generation

### Anthropic Recommended Pattern

**Key Differences:**

1. **Tool Discovery Structure**
   ```
   servers/
   ├── {server_name}/
   │   ├── __init__.ts (exports all tools)
   │   └── {tool_name}.ts (individual tool wrapper)
   ```
   Agent explores this to find available tools dynamically.

2. **Agent-Generated Code**
   The agent doesn't just call pre-written functions. It generates code that:
   - Explores the servers directory
   - Discovers available tools
   - Imports only needed tools
   - Executes them with control flow (loops, conditionals)
   - Processes results locally

3. **Local Data Processing**
   ```typescript
   const doc = await getDocument(docId);
   // Filter/process here - NOT in model context
   const summary = filterAndSummarize(doc);
   console.log(summary);  // Only summary goes to context
   ```

4. **No Upfront Tool Context**
   - Don't preload tool definitions in system prompt
   - Let agent discover through filesystem exploration
   - Load specific tool code only when used

5. **Explicit Logging Contract**
   - Only explicitly logged output becomes context
   - Side effects (updates, processing) stay local
   - Clear boundary: what model sees vs. what stays in environment

---

## Implementation Guidance

### Recommended Migration Path

1. **Create servers/ directory structure** with tool modules
2. **Generate tool discovery functions** so agents can list available tools
3. **Train agents to write code** that discovers and composes tools
4. **Remove upfront tool definitions** from system prompts
5. **Implement logging discipline** - only log what model needs to see
6. **Add data filtering patterns** - local processing before logging
7. **Build safety guardrails** - execution environment isolation, resource limits

### Key Metrics to Optimize

- **Tokens in context per task**: Target < 5k (down from 150k+)
- **Number of model rounds per task**: Target 1 (down from 5+)
- **Data flowing through model**: Target < 1% of fetched data
- **Tool definition tokens**: Target 0 unless specifically reading tool code
- **Intermediate result tokens**: Target 0 (stay in environment)

---

## Security Considerations

### Sandboxing Requirements

- Execution environment isolated from system
- Resource limits (CPU, memory, file access)
- Network isolation/allowlisting
- File system sandbox within workspace/

### Consent Model

- Explicit user authorization before tool execution
- Clear visibility into what code agent generated
- Ability to review/modify before execution
- Audit trail of all tool calls

### Data Handling

- Encryption mappings for sensitive data
- No logging of PII by default
- Clear data retention policies
- Privacy-preserving aggregation patterns

---

## Additional Resources

- **Official Blog**: https://www.anthropic.com/engineering/code-execution-with-mcp
- **MCP Specification**: https://modelcontextprotocol.io/specification/2025-06-18
- **Claude Docs**: https://docs.claude.com/en/docs/agents-and-tools/mcp
- **GitHub MCP Servers**: https://github.com/modelcontextprotocol/servers
- **Community Discussion**: Simon Willison's analysis at https://simonwillison.net/2025/Nov/4/code-execution-with-mcp/

---

## Summary

Anthropic's Code Execution with MCP represents a fundamental architectural shift:

**Old Model**: Model calls tools → Results flow through context → Model decides next action
- 150k+ tokens
- 5+ model round trips
- Sensitive data exposure risk
- High latency

**New Model**: Agent generates code → Code composes tools locally → Only summaries to model
- 2-5k tokens
- 1 model round trip
- Data isolation by architecture
- Low latency

The core insight: **Treat tools as code-level APIs accessed through filesystem structure, not as protocol-based function calls.** This enables progressive disclosure, local data processing, and direct tool composition—resulting in dramatic efficiency gains while maintaining security and privacy.
