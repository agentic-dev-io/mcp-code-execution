# Copilot Repository Instructions

This repository implements token-efficient MCP (Model Context Protocol) server interaction through code execution, achieving 95-99% token reduction through progressive tool disclosure and in-environment data processing.

## Build, Test, and Lint

### Python (uv)
- **Setup**: `uv sync` - Install all Python dependencies
- **Run script**: `uv run <script_name>.py` - Execute Python tasks
- **Run tests**: `pytest tests/ -v` - Run all Python tests
- **Run specific test**: `pytest tests/test_file.py::test_function -v`
- **Add dependency**: `uv add <package_name>`

### TypeScript (bun)
- **Setup**: `bun install` - Install all TypeScript dependencies
- **Run script**: `bun run <script_name>.ts` - Execute TypeScript tasks
- **Run tests**: `bun test` - Run all TypeScript tests
- **Watch mode**: `bun --watch <script_name>.ts` - Run with auto-reload
- **Add dependency**: `bun add <package_name>`

### Project Setup
- **Initial setup (Python)**: `python setup_mcp.py` - Initialize workspace structure
- **Initial setup (TypeScript)**: `bun run setup.ts` - Initialize workspace structure
- **Generate server wrappers**: Use Claude to generate MCP server wrappers from `mcp_config.json`

## Tech Stack

### Core Technologies
- **Python 3.10+** with **uv** package manager
- **TypeScript** with **bun** runtime
- **MCP (Model Context Protocol)** for tool integration
- **pytest** and **pytest-asyncio** for Python testing
- **bun test** for TypeScript testing

### Key Components
- **MCP Client Libraries**: `client/python.py` and `client/typescript.ts`
- **MCP Server Wrappers**: Auto-generated in `servers/python/` and `servers/typescript/`
- **Skills**: Reusable patterns in `skills/python/` and `skills/typescript/`
- **Workspace**: Isolated working directory in `workspace/`

## Project Architecture

### Directory Structure
```
mcp-code-execution/
├── client/              # MCP client libraries
├── servers/            # Auto-generated MCP server wrappers
│   ├── python/        # Python wrappers per server
│   └── typescript/    # TypeScript wrappers per server
├── skills/            # Reusable patterns/functions
│   ├── python/
│   └── typescript/
├── plugin/            # Claude Code plugin implementation
├── workspace/         # Working directory for file operations
├── mcp_config.json   # MCP server configuration
├── pyproject.toml    # Python dependencies
├── package.json      # TypeScript dependencies
└── tsconfig.json     # TypeScript config
```

### Three-Layer Pattern
1. **Progressive Tool Disclosure**: Load tool definitions on-demand from filesystem (500 tokens) instead of preloading all definitions (150k+ tokens)
2. **In-Environment Processing**: Process large datasets in execution environment (0 context tokens) instead of flowing through LLM
3. **Summarized Results**: Return only filtered/aggregated results (1-5k tokens) instead of raw data

## Coding Conventions

### Python Style (PEP 8)
- Use **type hints** for all function parameters and return values
- Use **4-space indentation**
- Maximum line length: **100 characters**
- Use **docstrings** (Google style) for all public functions
- Prefer **async/await** for I/O operations
- Use **descriptive variable names** (e.g., `filtered_leads` not `fl`)
- Import only what you need: `from servers.python.google_drive import get_document` (not `import *`)

### TypeScript Style
- Use **strict TypeScript mode** with explicit types
- Use **2-space indentation**
- Maximum line length: **100 characters**
- Use **JSDoc comments** for all exported functions
- Prefer **async/await** over callbacks or promises
- Use **interface** for complex objects
- Use **camelCase** for functions and variables
- Import only what you need: `import { getDocument } from './servers/typescript/googleDrive/index.js'`

### Naming Conventions
- **Python**: `snake_case` for functions, variables, and files (e.g., `extract_action_items.py`)
- **TypeScript**: `camelCase` for functions and variables, `PascalCase` for types/interfaces
- **MCP Server Wrappers**: Match MCP tool names (Python: `snake_case`, TypeScript: `camelCase`)
- **Skills**: Descriptive names indicating purpose (e.g., `filter_large_dataset`, `extractActionItems`)

### Code Organization
- **MCP Server Wrappers**: Each server gets its own directory with `__init__.py` (Python) or `index.ts` (TypeScript)
- **Skills**: Each skill is a separate file with clear documentation
- **Tasks**: Standalone scripts with `async def main()` pattern (Python) or `async function main()` (TypeScript)

## Token Efficiency Best Practices

### Critical Principles
1. **Import selectively**: Only import the specific tools needed, never use wildcard imports
2. **Process data locally**: Filter, aggregate, and transform data in the execution environment
3. **Return summaries**: Only send summarized results back to context, not full datasets
4. **Use skills**: Reuse proven patterns from `skills/` directory

### Good Patterns
```python
# ✅ Good: Import only what's needed
from servers.python.google_drive import get_document

# ✅ Good: Process data locally, return summary
doc = await get_document(document_id='abc123')
lines = doc['content'].split('\n')
filtered = [line for line in lines if 'ACTION:' in line]
print(f"Extracted {len(filtered)} action items from {len(doc['content'])} chars")
```

### Patterns to Avoid
```python
# ❌ Avoid: Wildcard imports load too many definitions
from servers.python.google_drive import *

# ❌ Avoid: Printing large datasets sends all data through context
data = await fetch_large_dataset()
print(data)  # Don't do this!
```

## Restrictions and Constraints

### File Modifications
- **DO NOT modify** files in `.claude/` or `.claude-plugin/` directories (agent instructions)
- **DO NOT modify** existing MCP server wrappers unless fixing bugs
- **DO NOT modify** `mcp_config.json` without user request
- **DO modify** skills when improving proven patterns
- **DO create** new skills for successful patterns

### Workspace Isolation
- All file operations should use `workspace/` directory
- Do not create files outside the workspace unless part of project structure
- Temporary files should go in `workspace/` and be cleaned up

### Dependencies
- Only add dependencies when absolutely necessary
- Prefer standard library functions when available
- Document why each new dependency is needed

## Project Context

### Purpose
This is a **Claude Code plugin** that enables token-efficient interaction with MCP servers through code execution. It's designed for:
- Processing large datasets without consuming context tokens
- Progressive loading of tool definitions
- Building reusable skills over time

### Key Insight
Traditional approach sends all tool definitions and data through context (250k+ tokens per task). This approach loads tools on-demand and processes data in execution environment (1.5k tokens per task), achieving 99%+ token reduction.

### Target Users
- Developers using Claude Code with MCP servers
- Teams working with large datasets (CRM, documents, databases)
- Projects requiring efficient token usage

## Documentation

### Required Documentation
- Update **README.md** for user-facing changes
- Update **CLAUDE.md** for developer guidance
- Update **CONTRIBUTING.md** for contributor guidelines
- Add **docstrings/JSDoc** for all new functions
- Include **examples** in code comments

### Documentation Style
- Keep instructions **clear and concise**
- Provide **working code examples**
- Include **expected output** where helpful
- Document **error cases** and handling

## MCP Configuration

### mcp_config.json Format
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-package"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### Common MCP Servers
- `@modelcontextprotocol/server-gdrive` - Google Drive
- `@modelcontextprotocol/server-github` - GitHub
- `@modelcontextprotocol/server-sqlite` - SQLite Database
- `@modelcontextprotocol/server-postgres` - PostgreSQL
- `@modelcontextprotocol/server-filesystem` - Local filesystem

## Error Handling

### Python
```python
import asyncio

async def main():
    try:
        # Task implementation
        result = await some_operation()
        print(f"✓ Success: {result}")
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    asyncio.run(main())
```

### TypeScript
```typescript
async function main() {
  try {
    // Task implementation
    const result = await someOperation();
    console.log(`✓ Success: ${result}`);
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

main();
```

## Testing Practices

### Test Organization
- Python tests in `tests/` directory
- TypeScript tests alongside implementation files or in `tests/`
- Use descriptive test names: `test_extract_action_items_with_custom_prefixes`

### Test Coverage
- Write tests for new skills
- Test error cases and edge cases
- Verify token efficiency patterns
- Test MCP client functionality

### Running Tests
```bash
# Python: Run all tests
pytest tests/ -v

# Python: Run with coverage
pytest tests/ --cov=client --cov=skills

# TypeScript: Run all tests
bun test
```

## Common Tasks

### Creating a New Skill
1. Implement the pattern in a task and verify it works
2. Extract the pattern to `skills/python/` or `skills/typescript/`
3. Add clear documentation and type hints
4. Add tests if applicable
5. Import and reuse in future tasks

### Generating MCP Server Wrappers
1. Add server configuration to `mcp_config.json`
2. Ask Claude: "Setup MCP server wrappers for [server-name]"
3. Claude generates wrapper functions in `servers/python/` and `servers/typescript/`
4. Import and use in tasks

### Processing Large Datasets
1. Load data using MCP server wrapper
2. Filter/aggregate/transform in execution environment
3. Return only summary or processed results
4. Document token savings in output

## Security Considerations

- Never commit secrets or credentials to the repository
- Use environment variables for sensitive configuration
- Validate all user inputs in MCP server wrappers
- Keep dependencies up to date
- Report security issues via security@anthropic.com (not public issues)

## Additional Resources

- **MCP Documentation**: https://modelcontextprotocol.io/
- **MCP Community Servers**: https://github.com/modelcontextprotocol/servers
- **uv Documentation**: https://github.com/astral-sh/uv
- **bun Documentation**: https://bun.sh/docs
- **Project README**: README.md
- **Developer Guide**: CLAUDE.md
- **Contributing Guide**: CONTRIBUTING.md
