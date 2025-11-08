/**
 * Setup MCP Workspace Command
 *
 * Initializes a complete MCP code execution workspace with:
 * - Directory structure (workspace, servers, skills)
 * - Configuration files (mcp_config.json, tsconfig.json, pyproject.toml)
 * - Python and TypeScript templates
 * - Example tasks
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SetupOptions {
  directory?: string;
  pythonEnabled?: boolean;
  typescriptEnabled?: boolean;
  exampleServers?: string[];
}

export async function setupMCPWorkspace(options: SetupOptions = {}): Promise<void> {
  const {
    directory = process.cwd(),
    pythonEnabled = true,
    typescriptEnabled = true,
    exampleServers = ['filesystem']
  } = options;

  console.log(`\n🚀 Setting up MCP Code Execution workspace in: ${directory}\n`);

  // Create directory structure
  const dirs = [
    'workspace',
    'servers/python',
    'servers/typescript',
    'skills/python',
    'skills/typescript',
    'plugin/commands',
    'plugin/agents',
    'plugin/hooks',
    'plugin/config',
    'client'
  ];

  console.log('📁 Creating directory structure...');
  for (const dir of dirs) {
    const fullPath = path.join(directory, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`   ✓ ${dir}`);
    }
  }

  // Create mcp_config.json
  console.log('\n⚙️  Creating configuration files...');
  const mcpConfig = {
    mcpServers: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', './workspace'],
        description: 'Local filesystem access'
      }
    }
  };

  fs.writeFileSync(
    path.join(directory, 'mcp_config.json'),
    JSON.stringify(mcpConfig, null, 2)
  );
  console.log('   ✓ mcp_config.json');

  // Create pyproject.toml if Python enabled
  if (pythonEnabled) {
    const pyprojectContent = `[project]
name = "mcp-code-execution"
version = "0.1.0"
description = "Token-efficient MCP server interaction through code execution"
requires-python = ">=3.10"
dependencies = [
    "mcp>=0.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
]

[tool.uv]
dev-dependencies = []

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
`;
    fs.writeFileSync(path.join(directory, 'pyproject.toml'), pyprojectContent);
    console.log('   ✓ pyproject.toml');
  }

  // Create package.json if TypeScript enabled
  if (typescriptEnabled) {
    const packageJsonContent = {
      name: 'mcp-code-execution',
      version: '0.1.0',
      description: 'Token-efficient MCP server interaction through code execution',
      type: 'module',
      scripts: {
        setup: 'bun run plugin/setup.ts',
        test: 'bun test'
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0'
      },
      devDependencies: {
        '@types/bun': 'latest',
        typescript: '^5.0.0'
      }
    };
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify(packageJsonContent, null, 2)
    );
    console.log('   ✓ package.json');
  }

  // Create tsconfig.json if TypeScript enabled
  if (typescriptEnabled) {
    const tsconfigContent = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: './dist',
        rootDir: './',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        lib: ['ES2020']
      },
      include: ['**/*.ts'],
      exclude: ['node_modules', 'dist']
    };
    fs.writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify(tsconfigContent, null, 2)
    );
    console.log('   ✓ tsconfig.json');
  }

  // Create .gitignore
  const gitignoreContent = `# Environment
.env
.env.local
.venv/
node_modules/
.bun/

# Build artifacts
dist/
build/
*.js
*.js.map
*.d.ts

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Cache
.pytest_cache/
__pycache__/
.mypy_cache/
`;
  fs.writeFileSync(path.join(directory, '.gitignore'), gitignoreContent);
  console.log('   ✓ .gitignore');

  // Create README.md for workspace
  const readmeContent = `# MCP Code Execution Workspace

This workspace is configured for token-efficient MCP server interaction through code execution.

## Quick Start

### Python Tasks
\`\`\`bash
uv sync
uv run example_task.py
\`\`\`

### TypeScript Tasks
\`\`\`bash
bun install
bun run example_task.ts
\`\`\`

## Adding MCP Servers

Edit \`mcp_config.json\` to add new servers:

\`\`\`json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": { "GDRIVE_CLIENT_ID": "...", "GDRIVE_CLIENT_SECRET": "..." }
    }
  }
}
\`\`\`

Then generate wrappers:

\`\`\`
/generate-wrappers google-drive
\`\`\`

## Available Skills

View all registered skills:

\`\`\`
/list-skills
\`\`\`

## Architecture

- \`workspace/\` - Working directory for file operations
- \`servers/\` - Auto-generated MCP server wrappers
- \`skills/\` - Reusable patterns and utilities
- \`client/\` - MCP client libraries (Python + TypeScript)

See CLAUDE.md for detailed documentation.
`;
  fs.writeFileSync(path.join(directory, 'README_WORKSPACE.md'), readmeContent);
  console.log('   ✓ README_WORKSPACE.md');

  // Install dependencies if available
  console.log('\n📦 Installing dependencies...');

  if (pythonEnabled) {
    try {
      execSync('uv sync', { cwd: directory, stdio: 'inherit' });
      console.log('   ✓ Python dependencies installed via uv');
    } catch (e) {
      console.log('   ⚠️  Could not install Python dependencies (uv not found)');
    }
  }

  if (typescriptEnabled) {
    try {
      execSync('bun install', { cwd: directory, stdio: 'inherit' });
      console.log('   ✓ TypeScript dependencies installed via bun');
    } catch (e) {
      console.log('   ⚠️  Could not install TypeScript dependencies (bun not found)');
    }
  }

  console.log('\n✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Configure MCP servers in mcp_config.json');
  console.log('  2. Run /generate-wrappers to create server wrappers');
  console.log('  3. Try example tasks in workspace/');
  console.log('  4. Read CLAUDE.md for detailed documentation');
  console.log('');
}

// Export for use as a command
export default setupMCPWorkspace;
