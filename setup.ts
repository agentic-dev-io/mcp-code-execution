#!/usr/bin/env bun
/**
 * Setup Script for Hybrid MCP Code Execution
 * Uses bun for TypeScript execution
 */

import { $ } from "bun";

console.log("🚀 Setting up Hybrid MCP Code Execution (uv + bun)...\n");

// Check tools
console.log("Checking tools...");

try {
  const uvVersion = await $`uv --version`.quiet();
  console.log(`✓ uv ${uvVersion.stdout.toString().trim()}`);
} catch {
  console.error("❌ uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh");
  process.exit(1);
}

try {
  const bunVersion = await $`bun --version`.quiet();
  console.log(`✓ bun ${bunVersion.stdout.toString().trim()}`);
} catch {
  console.error("❌ bun not found. Install: curl -fsSL https://bun.sh/install | bash");
  process.exit(1);
}

// Install dependencies
console.log("\n📦 Installing dependencies...");

console.log("Installing Python dependencies (uv)...");
await $`uv sync`.quiet();

console.log("Installing TypeScript dependencies (bun)...");
await $`bun install`.quiet();

console.log("\n✅ Setup complete!");
console.log("\nNext steps:");
console.log("1. Configure MCP servers in mcp_config.json");
console.log("2. Start Claude Code: claude-code --config mcp_config.json");
console.log("3. Ask Claude: 'Setup MCP server wrappers for all configured servers'");
