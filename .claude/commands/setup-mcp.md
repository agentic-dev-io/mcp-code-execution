# /setup-mcp

Initialize a complete MCP code execution workspace with directory structure, configuration files, and templates.

This command will create:
- Directory structure (workspace, servers, skills, plugin)
- Configuration files (mcp_config.json, tsconfig.json, pyproject.toml)
- Python and TypeScript templates
- Example tasks and documentation
- .gitignore and README files

**Usage:**
```
/setup-mcp [directory] [--python] [--typescript]
```

**Examples:**
- `/setup-mcp` - Setup in current directory with both Python and TypeScript
- `/setup-mcp ./my-workspace --typescript` - Setup TypeScript only
- `/setup-mcp /path/to/workspace` - Setup in specific directory
