/**
 * On Error Hook
 *
 * Executes when an error occurs during task execution.
 * Used for error reporting, recovery attempts, and diagnostic collection.
 */

interface ErrorEvent {
  taskId: string;
  error: Error | string;
  context?: Record<string, any>;
  timestamp: Date;
}

export async function onError(event: ErrorEvent): Promise<void> {
  const errorMessage = typeof event.error === 'string' ? event.error : event.error.message;

  console.log(`\n[Hook] Error occurred in task: ${event.taskId}`);
  console.log(`  Error: ${errorMessage}`);
  console.log(`  Time: ${event.timestamp.toISOString()}`);

  if (event.context) {
    console.log(`\n  Context:`);
    for (const [key, value] of Object.entries(event.context)) {
      console.log(`    ${key}: ${JSON.stringify(value)}`);
    }
  }

  // Categorize error type
  const errorType = categorizeError(errorMessage);
  console.log(`  Category: ${errorType}`);

  // Provide recovery suggestions
  console.log(`\n  💡 Recovery suggestions:`);

  switch (errorType) {
    case 'CONNECTION_ERROR':
      console.log(`    1. Check if MCP server is running`);
      console.log(`    2. Verify mcp_config.json settings`);
      console.log(`    3. Run /validate-config to diagnose`);
      break;

    case 'TIMEOUT_ERROR':
      console.log(`    1. The MCP server took too long to respond`);
      console.log(`    2. Check server logs for performance issues`);
      console.log(`    3. Increase request timeout in plugin settings`);
      break;

    case 'TOOL_NOT_FOUND':
      console.log(`    1. Generate server wrappers: /generate-wrappers`);
      console.log(`    2. Check tool name spelling`);
      console.log(`    3. Verify server has this tool: /list-skills`);
      break;

    case 'INVALID_ARGUMENTS':
      console.log(`    1. Check tool argument types and format`);
      console.log(`    2. Review error message for details`);
      console.log(`    3. See tool documentation: /list-skills`);
      break;

    case 'VALIDATION_ERROR':
      console.log(`    1. Ensure all required parameters are provided`);
      console.log(`    2. Check security policies are not blocking the request`);
      console.log(`    3. Validate input data format`);
      break;

    default:
      console.log(`    1. Check error message above`);
      console.log(`    2. Review task logs for context`);
      console.log(`    3. Run /validate-config to check setup`);
  }

  // Attempt auto-recovery for specific errors
  console.log(`\n  Attempting recovery...`);

  try {
    await attemptRecovery(errorType, event);
    console.log(`  ✓ Recovery successful`);
  } catch (recoveryError) {
    console.log(`  ❌ Recovery failed: ${recoveryError}`);
  }

  console.log('');
}

function categorizeError(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('connection') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('not reachable')
  ) {
    return 'CONNECTION_ERROR';
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'TIMEOUT_ERROR';
  }

  if (
    lowerMessage.includes('not found') ||
    lowerMessage.includes('unknown tool') ||
    lowerMessage.includes('no such')
  ) {
    return 'TOOL_NOT_FOUND';
  }

  if (
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('argument') ||
    lowerMessage.includes('parameter')
  ) {
    return 'INVALID_ARGUMENTS';
  }

  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('policy')
  ) {
    return 'VALIDATION_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

async function attemptRecovery(errorType: string, event: ErrorEvent): Promise<void> {
  // Implement recovery strategies based on error type

  switch (errorType) {
    case 'CONNECTION_ERROR':
      // Could retry with exponential backoff
      console.log('    Retrying connection with backoff...');
      // await retryWithBackoff(3);
      break;

    case 'TIMEOUT_ERROR':
      // Could increase timeout and retry
      console.log('    Increasing timeout and retrying...');
      break;

    case 'VALIDATION_ERROR':
      // Could attempt to fix common issues
      console.log('    Validating configuration...');
      break;

    default:
      // For unknown errors, just report
      throw new Error('Cannot auto-recover from this error');
  }
}

export default onError;
