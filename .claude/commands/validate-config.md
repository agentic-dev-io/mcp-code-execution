# /validate-config

Validate MCP configuration and workspace setup.

This command checks:
- mcp_config.json syntax and structure
- Directory structure integrity
- MCP server accessibility
- Dependency installation status
- Python and TypeScript setup

**Usage:**
```
/validate-config [--verbose]
```

**Examples:**
- `/validate-config` - Run basic validation
- `/validate-config --verbose` - Show detailed diagnostics

**Validation Checks:**
1. mcp_config.json exists and is valid JSON
2. Required directories exist (workspace, servers, skills)
3. MCP servers are configured correctly
4. Each server command is accessible
5. Python dependencies (if applicable)
6. TypeScript/Bun setup (if applicable)

**Output:**
- ✓ All systems operational
- ⚠ Warnings for optional features
- ✗ Critical errors blocking operation

**See Also:**
- `/setup-mcp` - Initialize workspace
- `/generate-wrappers` - Setup MCP server wrappers
