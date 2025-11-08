/**
 * Validate MCP Configuration Command
 *
 * Validates mcp_config.json for syntax errors, required fields, and connectivity.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, any>;
}

export async function validateConfig(configPath?: string): Promise<ValidationResult> {
  const fullPath = configPath || path.join(process.cwd(), 'mcp_config.json');

  console.log(`\n✓ Validating MCP Configuration: ${fullPath}\n`);

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: {}
  };

  // Check file exists
  if (!fs.existsSync(fullPath)) {
    result.valid = false;
    result.errors.push(`Configuration file not found: ${fullPath}`);
    return result;
  }

  // Parse JSON
  let config: any;
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    config = JSON.parse(content);
  } catch (e) {
    result.valid = false;
    result.errors.push(`Invalid JSON: ${e}`);
    return result;
  }

  // Validate structure
  if (!config.mcpServers) {
    result.errors.push('Missing required field: mcpServers');
    result.valid = false;
  } else {
    result.details.serverCount = Object.keys(config.mcpServers).length;

    // Validate each server
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      console.log(`  Checking server: ${serverName}`);

      const serverResult = validateServer(serverName, serverConfig as any);

      if (!serverResult.valid) {
        result.valid = false;
        result.errors.push(...serverResult.errors.map(e => `  [${serverName}] ${e}`));
      }

      result.warnings.push(...serverResult.warnings.map(w => `  [${serverName}] ${w}`));
      result.details[serverName] = serverResult;
    }
  }

  // Display results
  displayResults(result);

  return result;
}

function validateServer(name: string, config: any): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: {
      name,
      command: config.command,
      hasArgs: Array.isArray(config.args),
      hasEnv: typeof config.env === 'object'
    }
  };

  // Check required fields
  if (!config.command) {
    result.errors.push('Missing required field: command');
    result.valid = false;
  }

  if (!config.args || !Array.isArray(config.args)) {
    result.errors.push('Missing required field: args (must be array)');
    result.valid = false;
  }

  // Check if command is available
  try {
    const cmd = config.command;

    if (cmd === 'npx') {
      try {
        execSync('npx --version', { stdio: 'pipe' });
        result.details.commandAvailable = true;
      } catch {
        result.warnings.push('npx command not found (install Node.js to use)');
      }
    } else if (cmd === 'python' || cmd === 'python3') {
      try {
        execSync('python --version', { stdio: 'pipe' });
        result.details.commandAvailable = true;
      } catch {
        result.warnings.push('python command not found');
      }
    } else if (cmd === 'uv') {
      try {
        execSync('uv --version', { stdio: 'pipe' });
        result.details.commandAvailable = true;
      } catch {
        result.warnings.push('uv command not found (install from https://github.com/astral-sh/uv)');
      }
    } else if (cmd === 'bun') {
      try {
        execSync('bun --version', { stdio: 'pipe' });
        result.details.commandAvailable = true;
      } catch {
        result.warnings.push('bun command not found (install from https://bun.sh)');
      }
    }
  } catch (e) {
    // Silently fail - command check is optional
  }

  // Validate environment variables (optional)
  if (config.env && typeof config.env === 'object') {
    const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'API_KEY', 'TOKEN'];
    for (const [key, value] of Object.entries(config.env)) {
      if (!value) {
        result.warnings.push(`Environment variable not set: ${key}`);
      }

      if (requiredEnvVars.some(r => key.includes(r)) && value === 'YOUR_VALUE_HERE') {
        result.warnings.push(`Environment variable needs configuration: ${key}`);
      }
    }
  }

  return result;
}

function displayResults(result: ValidationResult): void {
  if (result.valid) {
    console.log('\n✅ Configuration is valid!\n');
  } else {
    console.log('\n❌ Configuration has errors:\n');
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
    console.log('');
  }

  if (result.details.serverCount !== undefined) {
    console.log(`📊 Summary:`);
    console.log(`  Total servers configured: ${result.details.serverCount}`);

    for (const [name, details] of Object.entries(result.details)) {
      if (name !== 'serverCount' && details && typeof details === 'object') {
        const detail = details as any;
        if (detail.name) {
          const status = detail.valid ? '✓' : '✗';
          console.log(`  ${status} ${detail.name}`);

          if (detail.commandAvailable !== undefined) {
            const cmdStatus = detail.commandAvailable ? '✓' : '?';
            console.log(`    ${cmdStatus} Command available`);
          }
        }
      }
    }
    console.log('');
  }

  if (!result.valid) {
    console.log('Next steps:');
    console.log('1. Fix the errors listed above');
    console.log('2. Check mcp_config.json syntax');
    console.log('3. Verify all required fields are present');
    console.log('4. Run /validate-config again to re-check\n');
  } else {
    console.log('Next steps:');
    console.log('1. Run /generate-wrappers to create server wrappers');
    console.log('2. Start using MCP servers in tasks\n');
  }
}

// Export for use as a command
export default validateConfig;
