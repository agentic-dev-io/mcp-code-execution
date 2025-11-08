"""
MCP Code Execution Setup with uv (Python) and bun (TypeScript)
================================================================

Hybrid setup for token-efficient MCP server interaction:
- Python (uv): Server wrappers, Skills, Task execution
- TypeScript (bun): MCP Client, Server generation, Type safety
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List


class HybridMCPSetup:
    """Setup for Python (uv) + TypeScript (bun) Code Execution"""
    
    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.servers_py_dir = workspace / "servers" / "python"
        self.servers_ts_dir = workspace / "servers" / "typescript"
        self.skills_py_dir = workspace / "skills" / "python"
        self.skills_ts_dir = workspace / "skills" / "typescript"
        self.workspace_dir = workspace / "workspace"
        self.config_file = workspace / "mcp_config.json"
        self.client_dir = workspace / "client"
        
    def setup(self):
        """Initialize workspace structure for both languages"""
        print("🚀 Setting up Hybrid MCP Code Execution (uv + bun)...")
        print()
        
        # Check tools
        self._check_tools()
        
        # Create directories
        self._create_directories()
        
        # Setup Python (uv)
        print("\n📦 Setting up Python environment (uv)...")
        self._setup_python()
        
        # Setup TypeScript (bun)
        print("\n📦 Setting up TypeScript environment (bun)...")
        self._setup_typescript()
        
        # Create client library
        self._create_client_library()
        
        # Create example skills
        self._create_example_skills()
        
        # Create templates
        self._create_templates()
        
        print("\n✅ Setup complete!")
        print("\nNext steps:")
        print("1. Install dependencies:")
        print("   uv sync")
        print("   bun install")
        print("2. Configure MCP servers in mcp_config.json")
        print("3. Start Claude Code: claude-code --config mcp_config.json")
        print("4. Ask Claude: 'Setup MCP server wrappers for all configured servers'")
        
    def _check_tools(self):
        """Check if uv and bun are available"""
        print("Checking tools...")
        
        # Check uv
        try:
            result = subprocess.run(
                ["uv", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"✓ uv {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh")
            sys.exit(1)
        
        # Check bun
        try:
            result = subprocess.run(
                ["bun", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"✓ bun {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ bun not found. Install: curl -fsSL https://bun.sh/install | bash")
            sys.exit(1)
    
    def _create_directories(self):
        """Create directory structure"""
        dirs = [
            self.servers_py_dir,
            self.servers_ts_dir,
            self.skills_py_dir,
            self.skills_ts_dir,
            self.workspace_dir,
            self.client_dir,
        ]
        
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        (self.workspace_dir / ".gitkeep").touch()
        print("✓ Created directory structure")
    
    def _setup_python(self):
        """Setup Python environment with uv"""
        # pyproject.toml should already exist
        if not (self.workspace / "pyproject.toml").exists():
            print("⚠️  pyproject.toml not found, creating...")
            self._create_pyproject()
        
        print("✓ Python environment ready (run 'uv sync' to install)")
    
    def _setup_typescript(self):
        """Setup TypeScript environment with bun"""
        # package.json should already exist
        if not (self.workspace / "package.json").exists():
            print("⚠️  package.json not found, creating...")
            self._create_package_json()
        
        # tsconfig.json should already exist
        if not (self.workspace / "tsconfig.json").exists():
            print("⚠️  tsconfig.json not found, creating...")
            self._create_tsconfig()
        
        print("✓ TypeScript environment ready (run 'bun install' to install)")
    
    def _create_pyproject(self):
        """Create pyproject.toml if not present"""
        pyproject = self.workspace / "pyproject.toml"
        pyproject.write_text("""[project]
name = "mcp-code-execution"
version = "0.1.0"
description = "Token-efficient MCP server interaction through code execution"
requires-python = ">=3.10"
dependencies = []

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
""")
    
    def _create_package_json(self):
        """Create package.json if not present"""
        package_json = self.workspace / "package.json"
        package_json.write_text("""{
  "name": "mcp-code-execution",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "generate-servers": "bun run scripts/generate-servers.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
""")
    
    def _create_tsconfig(self):
        """Create tsconfig.json if not present"""
        tsconfig = self.workspace / "tsconfig.json"
        tsconfig.write_text("""{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
""")
    
    def _create_client_library(self):
        """Create MCP Client library for both languages"""
        # Python Client
        client_py = self.client_dir / "python.py"
        client_py.write_text('''"""
MCP Client for Python Code Execution

Usage in server wrappers:
    from client.python import call_mcp_tool
    
    result = await call_mcp_tool('server_name', 'tool_name', {'param': 'value'})
"""

import asyncio
import json
from typing import Any, Dict


# This function is provided by Claude Code Runtime
# If not available, use a mock for local development
async def call_mcp_tool(server: str, tool: str, args: Dict[str, Any]) -> Any:
    """
    Call MCP tool.
    
    Args:
        server: Name of MCP server (e.g. 'google-drive')
        tool: Name of tool (e.g. 'get_document')
        args: Parameters as dictionary
    
    Returns:
        Tool result
    """
    # In Claude Code, this function is provided by the runtime
    # For local tests, mock this function
    raise NotImplementedError(
        "call_mcp_tool is provided by Claude Code Runtime. "
        "For local tests, mock this function."
    )
''')
        
        # TypeScript Client
        client_ts = self.client_dir / "typescript.ts"
        client_ts.write_text('''/**
 * MCP Client for TypeScript Code Execution
 * 
 * Usage in server wrappers:
 *   import { callMCPTool } from '../client/typescript.js';
 *   
 *   const result = await callMCPTool('server_name', 'tool_name', { param: 'value' });
 */

/**
 * Call MCP tool.
 * 
 * @param server Name of MCP server (e.g. 'google-drive')
 * @param tool Name of tool (e.g. 'getDocument')
 * @param args Parameters as object
 * @returns Tool result
 */
export async function callMCPTool<T = any>(
  server: string,
  tool: string,
  args: Record<string, any>
): Promise<T> {
  // In Claude Code, this function is provided by the runtime
  // For local tests, mock this function
  throw new Error(
    'callMCPTool is provided by Claude Code Runtime. ' +
    'For local tests, mock this function.'
  );
}
''')
        
        print("✓ Created client libraries (Python + TypeScript)")
    
    def _create_example_skills(self):
        """Create example skills for both languages"""
        # Python Skill
        skill_py = self.skills_py_dir / "example_data_filter.py"
        skill_py.write_text('''"""
Skill: Filter and transform data efficiently in execution environment

Demonstrates the key pattern: process large datasets HERE,
not through the LLM context window.
"""

from typing import List, Dict, Any


async def filter_large_dataset(
    data: List[Dict[str, Any]], 
    filter_key: str,
    filter_value: Any,
    output_fields: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Filter large dataset and extract only needed fields.
    
    Args:
        data: Large dataset to filter
        filter_key: Field to filter on
        filter_value: Value to match
        output_fields: Fields to keep (None = keep all)
    
    Returns:
        Filtered and transformed dataset
    """
    filtered = [row for row in data if row.get(filter_key) == filter_value]
    
    if output_fields:
        filtered = [
            {k: row[k] for k in output_fields if k in row}
            for row in filtered
        ]
    
    print(f"Filtered {len(data)} rows → {len(filtered)} rows")
    return filtered
''')
        
        # TypeScript Skill
        skill_ts = self.skills_ts_dir / "exampleDataFilter.ts"
        skill_ts.write_text('''/**
 * Skill: Filter and transform data efficiently in execution environment
 * 
 * Demonstrates the key pattern: process large datasets HERE,
 * not through the LLM context window.
 */

export interface FilterOptions<T> {
  filterKey: keyof T;
  filterValue: any;
  outputFields?: (keyof T)[];
}

/**
 * Filter large dataset and extract only needed fields.
 */
export async function filterLargeDataset<T extends Record<string, any>>(
  data: T[],
  options: FilterOptions<T>
): Promise<Partial<T>[]> {
  const { filterKey, filterValue, outputFields } = options;
  
  let filtered = data.filter(row => row[filterKey] === filterValue);
  
  if (outputFields) {
    filtered = filtered.map(row => {
      const result: Partial<T> = {};
      for (const field of outputFields) {
        if (field in row) {
          result[field] = row[field];
        }
      }
      return result;
    });
  }
  
  console.log(`Filtered ${data.length} rows → ${filtered.length} rows`);
  return filtered;
}
''')
        
        print("✓ Created example skills (Python + TypeScript)")
    
    def _create_templates(self):
        """Create templates for server wrapper generation"""
        # Python Template
        template_py = self.servers_py_dir / "TEMPLATE.md"
        template_py.write_text("""# Python Server Wrapper Template

Claude generates Python modules for each MCP server:

## Structure

```
servers/python/server_name/
├── __init__.py
├── tool_name_1.py
└── tool_name_2.py
```

## Tool File Template

```python
# servers/python/server_name/tool_name.py
\"\"\"
Tool description from MCP server
\"\"\"

from typing import Any, Dict
from client.python import call_mcp_tool


async def tool_name(param1: str, param2: int = None) -> Dict[str, Any]:
    \"\"\"
    Call MCP tool with typed parameters
    \"\"\"
    args = {'param1': param1}
    if param2 is not None:
        args['param2'] = param2
    
    return await call_mcp_tool('server_name', 'tool_name', args)
```
""")
        
        # TypeScript Template
        template_ts = self.servers_ts_dir / "TEMPLATE.md"
        template_ts.write_text("""# TypeScript Server Wrapper Template

Claude generates TypeScript modules for each MCP server:

## Structure

```
servers/typescript/server_name/
├── index.ts
├── toolName1.ts
└── toolName2.ts
```

## Tool File Template

```typescript
// servers/typescript/server_name/toolName.ts
import { callMCPTool } from '../../../client/typescript.js';

interface ToolNameInput {
  param1: string;
  param2?: number;
}

interface ToolNameResponse {
  result: string;
}

/**
 * Tool description from MCP server
 */
export async function toolName(input: ToolNameInput): Promise<ToolNameResponse> {
  return callMCPTool<ToolNameResponse>('server_name', 'tool_name', input);
}
```
""")
        
        print("✓ Created templates (Python + TypeScript)")


def main():
    """Run setup"""
    workspace = Path.cwd()
    
    print(f"Setting up Hybrid MCP Code Execution in: {workspace}")
    print()
    
    setup = HybridMCPSetup(workspace)
    setup.setup()


if __name__ == "__main__":
    main()
