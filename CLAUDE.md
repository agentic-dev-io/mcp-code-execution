# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a hybrid Python (uv) + TypeScript (bun) workspace for token-efficient MCP (Model Context Protocol) server interaction through code execution. The architecture implements progressive disclosure of tool definitions and context-efficient data processing to achieve 95-99% token reduction on data-heavy tasks.

## Core Architecture

### Three-Layer Pattern: Code Execution Approach

Instead of passing tools and data through context, this project implements a **code execution** pattern:

1. **Progressive Tool Disclosure**: Tool definitions are loaded from filesystem on-demand (500 tokens) instead of preloading all definitions (150k+ tokens)
2. **In-Environment Processing**: Large datasets and transformations happen in the execution environment (0 context tokens) instead of flowing through the LLM
3. **Summarized Results**: Only filtered/aggregated results go back to Claude (1-5k tokens) instead of raw data

**Traditional approach**: 250k+ tokens per task
**Code execution approach**: 1.5k tokens per task (99%+ reduction)

### Workspace Structure

```
mcp_code_execution/
├── mcp_config.json              # MCP Server configuration
├── pyproject.toml              # Python dependencies (uv)
├── package.json                # TypeScript dependencies (bun)
├── tsconfig.json               # TypeScript compiler config
├── setup_mcp.py                # Python setup script
├── setup.ts                    # TypeScript setup script
├── example_task.py             # Reference examples
│
├── client/                     # MCP Client libraries
│   ├── python.py              # Python client (call_mcp_tool)
│   └── typescript.ts          # TypeScript client (callMCPTool)
│
├── servers/                    # Auto-generated MCP server wrappers
│   ├── python/                # Python wrappers (Claude generates these)
│   │   └── {server_name}/
│   │       ├── __init__.py
│   │       └── {tool_name}.py
│   └── typescript/            # TypeScript wrappers (Claude generates these)
│       └── {serverName}/
│           ├── index.ts
│           └── {toolName}.ts
│
├── skills/                     # Reusable patterns saved by Claude
│   ├── python/
│   │   └── example_data_filter.py
│   └── typescript/
│       └── exampleDataFilter.ts
│
└── workspace/                  # Working directory for file operations
```

## Key Commands

### Setup and Installation

```bash
# Initial setup (creates directory structure, installs templates)
python setup_mcp.py
# or
bun run setup.ts

# Install Python dependencies
uv sync

# Install TypeScript dependencies
bun install
```

### Running Tasks

```bash
# Python task execution
uv run task_filename.py

# TypeScript task execution
bun run task_filename.ts

# Watch mode (useful for development)
bun --watch task_filename.ts
```

### Development with Dependencies

```bash
# Add new Python package
uv add package_name
uv pip install package_name  # Alternative syntax

# Add new TypeScript package
bun add package_name

# Freeze Python dependencies
uv freeze > requirements.txt
```

## MCP Configuration

Edit `mcp_config.json` to add servers:

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": { "GDRIVE_CLIENT_ID": "...", "GDRIVE_CLIENT_SECRET": "..." }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./workspace"]
    }
  }
}
```

**Common MCP Servers:**
- `@modelcontextprotocol/server-gdrive` - Google Drive
- `@modelcontextprotocol/server-github` - GitHub
- `@modelcontextprotocol/server-sqlite` - SQLite Database
- `@modelcontextprotocol/server-postgres` - PostgreSQL
- `@modelcontextprotocol/server-filesystem` - Local filesystem

## Code Patterns

### Pattern 1: Token-Efficient Data Processing

**Python:**
```python
from servers.python.google_drive import get_document
from skills.python.example_data_filter import filter_large_dataset

# Load data
doc = await get_document(document_id='abc123')

# Process IN execution environment, not through context
lines = doc['content'].split('\n')
filtered = [l for l in lines if 'ACTION:' in l]

# Return only summary
print(f"Extracted {len(filtered)} action items from {len(doc['content'])} chars")
```

**TypeScript:**
```typescript
import { getDocument } from './servers/typescript/googleDrive/index.js';
import { filterLargeDataset } from './skills/typescript/exampleDataFilter.js';

// Load data
const doc = await getDocument({ documentId: 'abc123' });

// Process IN execution environment
const filtered = doc.content
  .split('\n')
  .filter(line => line.includes('ACTION:'));

// Return only summary
console.log(`Extracted ${filtered.length} from ${doc.content.length} chars`);
```

### Pattern 2: Batch Processing with Aggregation

**Python:**
```python
from servers.python.salesforce import query

# Query can return 10k+ records - stays in environment
leads = await query(soql="SELECT Id, Name, Amount FROM Lead")

# Filter and aggregate locally (not through context)
high_value = [l for l in leads if l['Amount'] > 50000]
total = sum(l['Amount'] for l in high_value)
avg = total / len(high_value) if high_value else 0

# Return only metrics
metrics = {
    'total_leads': len(leads),
    'high_value_count': len(high_value),
    'total_value': total,
    'average_value': avg
}
print(metrics)
```

### Pattern 3: Reusable Skills

After solving a problem successfully, save the pattern as a skill:

**Python Skill** (`skills/python/extract_action_items.py`):
```python
def extract_action_items(text: str, prefixes: list[str] = None) -> list[str]:
    """Extract action items from text based on common prefixes."""
    if prefixes is None:
        prefixes = ['ACTION:', 'TODO:', 'FOLLOW-UP:']

    lines = text.split('\n')
    return [l.strip() for l in lines if any(l.strip().startswith(p) for p in prefixes)]
```

**TypeScript Skill** (`skills/typescript/extractActionItems.ts`):
```typescript
export async function extractActionItems(
  text: string,
  prefixes: string[] = ['ACTION:', 'TODO:', 'FOLLOW-UP:']
): Promise<string[]> {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => prefixes.some(p => l.startsWith(p)));
}
```

Future tasks reuse these immediately without re-explaining.

## Creating Server Wrappers

When you add an MCP server to `mcp_config.json`, ask Claude to generate wrappers:

```
"Setup MCP server wrappers for all configured servers.

For each server:
1. List available tools
2. Generate Python modules in servers/python/{server_name}/
3. Generate TypeScript modules in servers/typescript/{serverName}/
4. Create __init__.py / index.ts with exports
5. Add type hints and docstrings"
```

Claude generates:

**Python:**
```python
# servers/python/google_drive/__init__.py
from .get_document import get_document
from .list_files import list_files

__all__ = ['get_document', 'list_files']
```

**TypeScript:**
```typescript
// servers/typescript/googleDrive/index.ts
export { getDocument } from './getDocument.js';
export { listFiles } from './listFiles.js';
```

## Development Workflow

### Single Task Execution

```bash
# Write task, then run it
uv run my_task.py
# or
bun run my_task.ts
```

### Task Template Pattern

Always use async functions with proper error handling:

**Python:**
```python
import asyncio

async def main():
    try:
        # 1. Load data
        # 2. Process in environment
        # 3. Return summary
        print("Task complete")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

**TypeScript:**
```typescript
async function main() {
  try {
    // 1. Load data
    // 2. Process in environment
    // 3. Return summary
    console.log('Task complete');
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

main();
```

## Best Practices

### 1. Import Only What You Need

**Good:**
```python
from servers.python.google_drive import get_document
```

**Avoid:**
```python
from servers.python.google_drive import *  # Loads unnecessary definitions
```

### 2. Process Large Data Locally

**Good:**
```python
data = await fetch_large_dataset()
filtered = [row for row in data if row['status'] == 'active']
print(f"Filtered to {len(filtered)} rows")
```

**Avoid:**
```python
data = await fetch_large_dataset()
print(data)  # Entire dataset goes through context
```

### 3. Return Only Summaries

**Good:**
```python
results = [{"id": r['id'], "value": r['value']} for r in data]
print(f"Processed {len(results)} records: {results[:5]}...")
```

**Avoid:**
```python
print(results)  # All data goes through context
```

### 4. Build Skills Over Time

After multiple similar successful tasks, save the pattern as a skill. Subsequent tasks become much simpler.

## Troubleshooting

### Import Errors in Tasks

**Problem:** `ModuleNotFoundError: No module named 'servers.python.google_drive'`

**Solution:** Generate server wrappers:
```
"Setup MCP server wrappers for google-drive"
```

Verify the directory exists:
```bash
ls servers/python/
```

### MCP Server Won't Connect

**Problem:** `ConnectionError: Cannot connect to MCP server`

**Solution:**
1. Check `mcp_config.json` is valid JSON
2. Verify MCP server command is available:
   ```bash
   npx -y @modelcontextprotocol/server-gdrive
   ```
3. Check environment variables are set correctly

### Token Usage Still High

**Problem:** Tasks are still using too many tokens

**Solution:**
1. Check you're importing only needed tools (not `import *`)
2. Verify you're processing data locally, not printing it all
3. Look for places where large datasets flow through print statements
4. Use `print(f"Summary: {len(data)} items")` instead of `print(data)`

### Tests Not Running

**Python:**
```bash
# Install test dependencies
uv pip install -e ".[dev]"

# Run tests
uv run pytest tests/ -v

# Run single test
uv run pytest tests/test_file.py::test_function -v
```

**TypeScript:**
```bash
# Install test dependencies (add bun testing package)
bun add -d @types/bun

# Run tests with Bun test runner
bun test
```

## Hybrid Python + TypeScript

Both languages are available for different strengths:

- **Python**: Data processing, ML libraries, existing Python integrations
- **TypeScript**: Type safety, web APIs, modern async patterns

Mix in the same workspace:

```python
# Python task
from servers.python.salesforce import query

leads = await query(...)
```

```typescript
// TypeScript task
import { query } from './servers/typescript/salesforce/index.js';

const leads = await query(...);
```

## Token Efficiency Comparison

| Task Type | Traditional | Code Execution | Savings |
|-----------|-------------|-----------------|---------|
| Document extraction | 250k tokens | 1.5k tokens | 99.4% |
| Batch data filtering | 180k tokens | 2k tokens | 98.9% |
| Multi-step workflow | 320k tokens | 3k tokens | 99.1% |

The key: Process data where it lives (execution environment), not in context.

## Plugin Status

This project is now a **Claude Code Marketplace Plugin (v1.0)** with:

### Core Features
- ✅ Plugin manifest (`plugin.json`)
- ✅ Slash commands for setup, configuration, and skill management
- ✅ Agents for automated task execution
- ✅ Hooks for task lifecycle management
- ✅ Python and TypeScript client libraries
- ✅ Retry logic, security policies, and monitoring
- ✅ Skill registry system
- ✅ MCP server configuration

### Client Libraries

**Python Client** (`client/python.py`):
- MCP protocol implementation via stdio transport
- Type hints and async/await support
- Includes: retry.py, security.py, monitoring.py
- Full error handling with retries and timeouts

**TypeScript Client** (`client/typescript.ts`):
- MCP SDK integration with proper types
- Connection pooling and lifecycle management
- Supports streaming for large responses

### Server Wrapper Generation

Claude auto-generates wrappers from MCP server definitions:

```python
# Example: servers/python/google_drive/get_document.py
from client.python import call_mcp_tool
from typing import Any, Dict

async def get_document(document_id: str) -> Dict[str, Any]:
    """Fetch document from Google Drive by ID."""
    return await call_mcp_tool(
        'google-drive',
        'get_document',
        {'document_id': document_id}
    )
```

### Skills Registry

Available skills are discoverable via `/list-skills` command:

- `extract-action-items`: Extract ACTION:/TODO:/FOLLOW-UP: items from text
- `filter-large-dataset`: Efficiently process large datasets in-environment

Create new skills with `/create-skill` command.

### Security & Monitoring

- ✅ Workspace isolation via `workspace/` directory
- ✅ Rate limiting per MCP server (configurable)
- ✅ Request timeout controls
- ✅ Performance metrics collection
- ✅ Error handling with exponential backoff

## Plugin Package Structure

```
mcp-code-execution/
├── plugin.json                    # Single plugin manifest (Claude Code compatible)
├── README.md                      # Main documentation
├── CLAUDE.md                      # Developer guidelines
├── CHANGELOG.md                   # Version history
├── LICENSE                        # MIT License
│
├── plugin/                        # Plugin implementation
│   ├── commands/                 # Slash commands
│   │   ├── setupMCP.ts
│   │   ├── generateWrappers.ts
│   │   ├── listSkills.ts
│   │   ├── createSkill.ts
│   │   └── validateConfig.ts
│   ├── agents/                   # Subagents
│   │   └── taskExecutor.ts
│   ├── hooks/                    # Lifecycle hooks
│   │   ├── onTaskStart.ts
│   │   ├── onTaskComplete.ts
│   │   └── onError.ts
│   └── config/
│       └── default-config.json
│
├── client/                       # MCP client libraries
│   ├── python.py                # Python MCP client
│   ├── typescript.ts            # TypeScript MCP client
│   ├── retry.py                 # Retry logic
│   ├── security.py              # Security policies
│   └── monitoring.py            # Performance monitoring
│
├── skills/                       # Reusable skills
│   ├── python/
│   │   ├── __init__.py
│   │   ├── extract_action_items.py
│   │   └── example_data_filter.py
│   └── typescript/
│       └── exampleDataFilter.ts
│
├── servers/                      # Auto-generated MCP wrappers
│   ├── python/
│   │   └── {server_name}/
│   │       ├── __init__.py
│   │       └── {tool_name}.py
│   └── typescript/
│       └── {serverName}/
│           ├── index.ts
│           └── {toolName}.ts
│
├── workspace/                    # Runtime directory for file operations
│
├── pyproject.toml               # Python project config (uv)
├── package.json                 # TypeScript project config (bun)
├── tsconfig.json                # TypeScript compiler config
├── mcp_config.json              # MCP server configuration
│
├── setup_mcp.py                 # Python setup script
└── setup.ts                     # TypeScript setup script
```

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Community Servers](https://github.com/modelcontextprotocol/servers)
- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Claude Code Plugins Guide](./refs/claude-code-plugins-reference.md)
- [uv Documentation](https://github.com/astral-sh/uv)
- [Bun Documentation](https://bun.sh/docs)
- [Anthropic Engineering Blog](https://www.anthropic.com/engineering/code-execution-with-mcp)

## Contributing

This project is open source and contributions are welcome. See IMPLEMENTATION.md for development guidelines and current priorities.
