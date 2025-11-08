# Plugin System Documentation

This directory contains the Claude Code plugin for MCP Code Execution.

## Structure

```
plugin/
├── plugin.json                 # Plugin manifest (metadata, commands, config)
├── README.md                   # This file
├── commands/
│   ├── setupMCP.ts            # Initialize workspace
│   ├── generateWrappers.ts    # Create server wrappers
│   ├── listSkills.ts          # Display skills registry
│   ├── createSkill.ts         # Register new skills
│   └── validateConfig.ts      # Check configuration
├── agents/
│   └── taskExecutor.ts        # Execute MCP tasks
├── hooks/
│   ├── onTaskStart.ts         # Pre-flight validation
│   ├── onTaskComplete.ts      # Post-execution cleanup
│   └── onError.ts             # Error handling
└── config/
    └── default-config.json    # Default plugin settings
```

## Plugin Manifest (plugin.json)

The `plugin.json` file defines:

```json
{
  "name": "mcp-code-execution",
  "version": "1.0.0",
  "commands": [
    {
      "name": "setup-mcp",
      "displayName": "Setup MCP Workspace",
      "implementation": "plugin/commands/setupMCP.ts"
    }
  ],
  "agents": [
    {
      "name": "task-executor",
      "implementation": "plugin/agents/taskExecutor.ts"
    }
  ],
  "hooks": [
    {
      "name": "on-task-start",
      "implementation": "plugin/hooks/onTaskStart.ts"
    }
  ],
  "configuration": {
    "properties": {
      "workspace_directory": {
        "type": "string",
        "default": "./workspace"
      }
    }
  }
}
```

## Commands

### /setup-mcp
**File:** `commands/setupMCP.ts`

Initialize a new MCP code execution workspace.

**What it does:**
1. Creates directory structure (workspace, servers, skills, etc.)
2. Generates configuration files (mcp_config.json, pyproject.toml, etc.)
3. Installs Python and TypeScript dependencies
4. Creates .gitignore and README

**Usage:**
```
/setup-mcp
/setup-mcp --directory /path/to/workspace
```

### /generate-wrappers
**File:** `commands/generateWrappers.ts`

Generate Python and TypeScript wrapper modules for configured MCP servers.

**What it does:**
1. Reads mcp_config.json
2. Discovers tools from each server
3. Generates Python modules in `servers/python/{server_name}/`
4. Generates TypeScript modules in `servers/typescript/{serverName}/`
5. Creates type definitions and docstrings

**Usage:**
```
/generate-wrappers
/generate-wrappers google-drive
```

### /list-skills
**File:** `commands/listSkills.ts`

Display all registered reusable skills.

**What it does:**
1. Reads plugin.json skills registry
2. Filters by language, tag, or search query
3. Shows descriptions, examples, authors
4. Displays code previews

**Usage:**
```
/list-skills
/list-skills --language python
/list-skills --tag "data-processing"
/list-skills --search "filter"
```

### /create-skill
**File:** `commands/createSkill.ts`

Create a new reusable skill from successful code.

**What it does:**
1. Creates skill file with proper header
2. Updates plugin.json registry
3. Makes skill discoverable for future tasks
4. Supports Python and TypeScript

**Usage:**
```
/create-skill --name "extract-emails" --language python --code "..."
/create-skill --name my-skill --language typescript --tags "nlp,text"
```

### /validate-config
**File:** `commands/validateConfig.ts`

Check MCP configuration for errors and issues.

**What it does:**
1. Validates mcp_config.json syntax
2. Checks required fields (command, args)
3. Verifies commands are available (npx, python, bun, etc.)
4. Tests environment variables
5. Provides recovery suggestions

**Usage:**
```
/validate-config
```

## Agents

### Task Executor
**File:** `agents/taskExecutor.ts`

Execute MCP tasks with token efficiency optimization.

**What it does:**
1. **Phase 1:** Progressive tool loading (load definitions on demand)
2. **Phase 2:** Load required skills
3. **Phase 3:** Execute task logic in environment
4. **Phase 4:** Collect metrics

**Features:**
- Automatic data processing (doesn't go through context)
- Intelligent summarization
- Error handling with retries
- Security policy enforcement
- Metrics collection

**Usage:**
```typescript
import { executeTask } from './agents/taskExecutor';

const result = await executeTask({
  description: 'Process large dataset',
  servers: ['filesystem', 'google-drive'],
  skills: ['extract-action-items', 'filter-large-dataset'],
  options: {
    maxRetries: 3,
    collectMetrics: true
  }
});
```

## Hooks

Hooks provide extension points for plugin lifecycle events.

### On Task Start
**File:** `hooks/onTaskStart.ts`

Executes **before** a task starts.

**What it does:**
1. Validates server configuration
2. Initializes metrics collection
3. Sets up execution environment
4. Performs pre-flight checks

**Usage in plugin.json:**
```json
{
  "hooks": [
    {
      "name": "on-task-start",
      "implementation": "plugin/hooks/onTaskStart.ts"
    }
  ]
}
```

### On Task Complete
**File:** `hooks/onTaskComplete.ts`

Executes **after** a task completes successfully.

**What it does:**
1. Reports performance metrics
2. Suggests skill creation
3. Cleans up resources
4. Logs task completion

### On Error
**File:** `hooks/onError.ts`

Executes when an error occurs during task execution.

**What it does:**
1. Categorizes error type (connection, timeout, validation, etc.)
2. Provides recovery suggestions
3. Attempts automatic recovery
4. Logs error for diagnostics

## Configuration

Default settings in `config/default-config.json`:

```json
{
  "execution": {
    "maxRetries": 3,
    "requestTimeoutMs": 30000
  },
  "security": {
    "enabled": true,
    "policies": {
      "workspace": true,
      "rateLimit": true,
      "sensitiveData": true,
      "inputValidation": true
    }
  },
  "monitoring": {
    "enabled": true,
    "metricsCollection": true
  }
}
```

### Configuration Options

**Execution**
- `maxRetries` - Number of retries (default: 3)
- `requestTimeoutMs` - Request timeout in ms (default: 30000)
- `connectionTimeoutMs` - Connection timeout (default: 10000)

**Security**
- `workspace.enabled` - Enable workspace isolation
- `rateLimit.enabled` - Enable rate limiting
- `sensitiveData.enabled` - Enable data detection
- `inputValidation.enabled` - Enable input validation

**Monitoring**
- `metricsCollection.enabled` - Track metrics
- `logging.level` - Log level (debug, info, warn, error)

**Skills**
- `autoDiscovery` - Auto-discover skills
- `cacheEnabled` - Cache skill modules

## Development

### Adding a New Command

1. Create file in `plugin/commands/{commandName}.ts`
2. Export main function with proper signature
3. Update `plugin.json` with command definition
4. Test with `/command-name`

Example:
```typescript
// plugin/commands/myCommand.ts
export async function myCommand(options: MyOptions): Promise<void> {
  console.log('Doing something...');
}

export default myCommand;
```

Then add to `plugin.json`:
```json
{
  "commands": [
    {
      "name": "my-command",
      "displayName": "My Command",
      "implementation": "plugin/commands/myCommand.ts"
    }
  ]
}
```

### Adding a New Hook

1. Create file in `plugin/hooks/{hookName}.ts`
2. Export handler function
3. Update `plugin.json` with hook definition

Example:
```typescript
// plugin/hooks/myHook.ts
export async function myHook(event: MyEvent): Promise<void> {
  console.log('Hook triggered!');
}

export default myHook;
```

### Testing Commands

```bash
# Test setup
/setup-mcp --directory ./test-workspace

# Test validation
/validate-config

# Test generation
/generate-wrappers

# Test skills
/list-skills
/create-skill --name test --language python
```

## Debugging

Enable debug logging in `plugin/config/default-config.json`:

```json
{
  "monitoring": {
    "logging": {
      "level": "debug"
    }
  }
}
```

Check logs in `mcp-execution.log`.

## Best Practices

1. **Always validate config** - Run `/validate-config` before tasks
2. **Generate wrappers early** - Use `/generate-wrappers` after adding servers
3. **Monitor metrics** - Enable metrics collection for all tasks
4. **Create skills** - Save successful patterns as skills
5. **Check security** - Ensure policies are enabled

## Troubleshooting

### Command Not Found
- Check file exists in `plugin/commands/`
- Verify export in `plugin.json`
- Check file name matches command name

### Hook Not Triggering
- Verify hook is defined in `plugin.json`
- Check implementation file path
- Enable debug logging

### Configuration Issues
- Run `/validate-config` to check setup
- Review `plugin/config/default-config.json`
- Check `mcp_config.json` for syntax errors

## Resources

- **Plugin Manifest:** See `plugin.json`
- **Marketplace Submission:** See `MARKETPLACE_SUBMISSION.md`
- **Plugin README:** See `PLUGIN_README.md`
- **Full Documentation:** See `CLAUDE.md`
- **Implementation Roadmap:** See `IMPLEMENTATION.md`

## Future Extensions

Planned plugin enhancements:

- **Skill marketplace** - Share and discover community skills
- **Real-time dashboard** - Monitor metrics and performance
- **Advanced caching** - Cache tool definitions and results
- **Distributed execution** - Scale across multiple workers
- **Custom hooks** - User-defined event handlers

---

**Plugin System Ready for Production!** 🚀
