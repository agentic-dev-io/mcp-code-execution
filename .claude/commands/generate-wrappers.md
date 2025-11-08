# /generate-wrappers

Generate Python and TypeScript wrapper modules for configured MCP servers.

This command will:
- Read MCP server definitions from mcp_config.json
- Generate Python modules in servers/python/{server_name}/
- Generate TypeScript modules in servers/typescript/{serverName}/
- Create __init__.py and index.ts with proper exports
- Add type hints and documentation

**Usage:**
```
/generate-wrappers [server_name] [--python] [--typescript]
```

**Examples:**
- `/generate-wrappers` - Generate wrappers for all configured servers
- `/generate-wrappers google-drive` - Generate for specific server
- `/generate-wrappers google-drive --typescript` - TypeScript only
- `/generate-wrappers --python` - Python wrappers only for all servers

**Prerequisites:**
- mcp_config.json must exist with server definitions
- MCP servers must be accessible and responding
