/**
 * Test Task: Python Code Generation
 *
 * Tests that the task executor can generate Python code
 */

import { executeTask, formatTaskResult } from './plugin/agents/taskExecutor.js';

async function main() {
  console.log('═'.repeat(60));
  console.log('Testing Python Code Generation');
  console.log('═'.repeat(60));

  // Test Python code generation
  console.log('\n📋 Test: Python Code Generation\n');
  const result = await executeTask({
    description: 'Process data with Python',
    language: 'python',
    options: {
      collectMetrics: true
    }
  });

  console.log('\n' + formatTaskResult(result));

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Python Test Completed');
  console.log('═'.repeat(60));
}

main().catch(console.error);

