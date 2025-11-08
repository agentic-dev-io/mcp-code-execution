# Plugin Structure Overview

## Directory Organization

```
mcp-code-execution/
├── 📄 Core Plugin Files
│   ├── plugin.json                    # Plugin manifest (Claude Code compatible)
│   ├── README.md                      # Getting started & usage guide
│   ├── CLAUDE.md                      # Developer guidelines & patterns
│   ├── CHANGELOG.md                   # Version history
│   ├── LICENSE                        # MIT License
│   └── STRUCTURE.md                   # This file
│
├── 🔌 Plugin Implementation (plugin/)
│   ├── commands/                      # Slash commands
│   │   ├── setupMCP.ts               # Initialize workspace
│   │   ├── generateWrappers.ts       # Generate MCP wrappers
│   │   ├── listSkills.ts             # List registered skills
│   │   ├── createSkill.ts            # Create new skill
│   │   └── validateConfig.ts         # Validate MCP config
│   │
│   ├── agents/                        # Autonomous agents
│   │   └── taskExecutor.ts           # Execute token-efficient tasks
│   │
│   ├── hooks/                         # Lifecycle hooks
│   │   ├── onTaskStart.ts            # Before task execution
│   │   ├── onTaskComplete.ts         # After task execution
│   │   └── onError.ts                # Error handling
│   │
│   └── config/
│       └── default-config.json        # Default plugin configuration
│
├── 🔧 Client Libraries (client/)
│   ├── python.py                      # Python MCP client
│   ├── typescript.ts                  # TypeScript MCP client
│   ├── retry.py                       # Retry logic with exponential backoff
│   ├── security.py                    # Security policies & validation
│   └── monitoring.py                  # Performance metrics & logging
│
├── 🎯 Reusable Skills (skills/)
│   ├── python/
│   │   ├── __init__.py
│   │   ├── extract_action_items.py   # Extract ACTION:/TODO: items
│   │   └── example_data_filter.py    # Filter large datasets
│   │
│   └── typescript/
│       └── exampleDataFilter.ts       # Data filtering (TypeScript)
│
├── 📦 Auto-Generated Server Wrappers (servers/)
│   ├── python/
│   │   ├── {server_name}/
│   │   │   ├── __init__.py
│   │   │   └── {tool_name}.py        # Wrapper for each tool
│   │   └── ...
│   │
│   └── typescript/
│       ├── {serverName}/
│       │   ├── index.ts
│       │   └── {toolName}.ts          # Wrapper for each tool
│       └── ...
│
├── 📂 Runtime Directory (workspace/)
│   └── ...                             # Code execution sandbox
│
└── ⚙️ Configuration & Setup
    ├── mcp_config.json                # MCP server configuration
    ├── pyproject.toml                 # Python project (uv)
    ├── package.json                   # TypeScript project (bun)
    ├── tsconfig.json                  # TypeScript compiler config
    ├── setup_mcp.py                   # Python setup script
    └── setup.ts                       # TypeScript setup script
```

## Key Files Explained

### `plugin.json`
Single source of truth for plugin manifest. Defines:
- **Commands**: `/setup-mcp`, `/generate-wrappers`, `/list-skills`, `/create-skill`, `/validate-config`
- **Agents**: MCP task executor for automated execution
- **Hooks**: Lifecycle management (task start, complete, error)
- **Skills**: Registered reusable patterns
- **Configuration**: Plugin settings with defaults
- **Capabilities**: Code execution, file system, monitoring

### `mcp_config.json`
MCP server configuration (not plugin config):
```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": { "GDRIVE_CLIENT_ID": "..." }
    }
  }
}
```

### `plugin/config/default-config.json`
Plugin configuration defaults (can be overridden by users):
- `workspaceDirectory`: Sandbox directory for execution
- `maxRetries`: Retry policy for failed tool calls
- `requestTimeoutMs`: Request timeout
- `enableMetrics`: Performance monitoring
- `enableSecurityPolicies`: Security enforcement
- `rateLimitCallsPerMinute`: Rate limiting per server
- `autoSkillDiscovery`: Auto-register new skills

## Workflow

### 1. User runs `/setup-mcp`
- Creates workspace directory
- Initializes mcp_config.json
- Sets up default configuration

### 2. User configures MCP servers
- Edits mcp_config.json
- Adds servers and credentials
- Runs `/validate-config` to test

### 3. User runs `/generate-wrappers`
- Reads MCP server definitions
- Generates Python modules in `servers/python/{server_name}/`
- Generates TypeScript modules in `servers/typescript/{serverName}/`
- Creates `__init__.py` / `index.ts` with exports

### 4. User writes task code
```python
# Python task
from servers.python.google_drive import get_document
from skills.python.extract_action_items import extract_action_items

doc = await get_document(document_id='xyz')
items = extract_action_items(doc['content'])
```

### 5. Code executes in workspace
- Data processed in-environment
- Only summary returned to Claude
- Token efficiency: 95-99% reduction

### 6. User creates skills
- After successful task, run `/create-skill`
- Claude registers pattern for reuse
- Future tasks use proven implementations

## Client Libraries

### Python Client (`client/python.py`)
- Communicates with MCP servers via stdio
- Async/await support
- Type hints for IDE support
- Integrates with retry.py, security.py, monitoring.py

### TypeScript Client (`client/typescript.ts`)
- MCP SDK integration
- Type-safe tool calls
- Connection pooling
- Streaming support

## Security Model

1. **Workspace Isolation**: File access limited to `workspace/` directory
2. **Network Restriction**: Only configured MCP servers
3. **Rate Limiting**: Configurable per-server limits
4. **Input Validation**: Security policies in `client/security.py`
5. **Monitoring**: Performance metrics and error tracking

## Extension Points

### Add New Command
1. Create `plugin/commands/myCommand.ts`
2. Add to `plugin.json` commands array
3. Implement command handler

### Add New Skill
1. Solve a task successfully
2. Run `/create-skill` to register pattern
3. Or manually create in `skills/python/` or `skills/typescript/`

### Add New MCP Server
1. Install server: `npm install @modelcontextprotocol/server-name`
2. Add to `mcp_config.json`
3. Run `/generate-wrappers` to create wrappers

## Best Practices

- **Progressive Loading**: Import only needed tools
- **Local Processing**: Filter/aggregate data in-environment
- **Summarize Results**: Return only summary to context
- **Build Skills**: Save proven patterns as reusable skills
- **Monitor Metrics**: Check token usage and performance

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.
