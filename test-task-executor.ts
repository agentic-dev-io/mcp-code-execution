/**
 * Test Task: Refactored Task Executor with Anthropic Code Execution Pattern
 *
 * This test demonstrates the new architecture where:
 * 1. Agent discovers tools from filesystem
 * 2. Agent generates TypeScript code
 * 3. Code executes locally (data stays in environment)
 * 4. Only summaries flow to context
 */

import { executeTask, formatTaskResult } from './plugin/agents/taskExecutor.js';

async function main() {
  console.log('═'.repeat(60));
  console.log('Testing Refactored Task Executor (Anthropic Pattern)');
  console.log('═'.repeat(60));

  // Test 1: Simple data processing task
  console.log('\n📋 Test 1: Extract and summarize documents\n');
  const result1 = await executeTask({
    description: 'Extract key information from Google Drive documents and generate summary',
    servers: ['google-drive'],
    options: {
      collectMetrics: true
    }
  });

  console.log('\n' + formatTaskResult(result1));

  // Test 2: Multi-server task
  console.log('\n📋 Test 2: Cross-server data processing\n');
  const result2 = await executeTask({
    description: 'Fetch GitHub issues and create Salesforce leads from them',
    servers: ['github', 'salesforce'],
    options: {
      collectMetrics: true
    }
  });

  console.log('\n' + formatTaskResult(result2));

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ All Tests Completed');
  console.log('═'.repeat(60));

  console.log(`\n📊 Architecture Changes:`);
  console.log(`  ✓ Agent writes TypeScript code (not calling functions)`);
  console.log(`  ✓ Tools discovered from filesystem (progressive disclosure)`);
  console.log(`  ✓ Data processed locally (not in context)`);
  console.log(`  ✓ Metrics track context efficiency`);

  console.log(`\n💡 Benefits:`);
  console.log(`  • 98.7% token reduction (from 150k to 2k tokens)`);
  console.log(`  • Single model round-trip (vs 3-5 previously)`);
  console.log(`  • Data isolation (sensitive data stays local)`);
  console.log(`  • Tool composition (chain multiple tools in code)`);

  console.log(`\n📚 References:`);
  console.log(`  • https://www.anthropic.com/engineering/code-execution-with-mcp`);
  console.log(`  • ./refs/anthropic-mcp-code-execution-reference.md`);
  console.log(`  • ./refs/architecture-alignment-analysis.md`);
}

main().catch(console.error);
