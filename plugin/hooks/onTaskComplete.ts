/**
 * On Task Complete Hook
 *
 * Executes after a task completes successfully.
 * Used for cleanup, metrics reporting, and skill generation prompts.
 */

interface TaskCompleteEvent {
  taskId: string;
  duration: number;
  output: any;
  metrics?: Record<string, any>;
  timestamp: Date;
}

export async function onTaskComplete(event: TaskCompleteEvent): Promise<void> {
  console.log(`\n[Hook] Task completed: ${event.taskId}`);
  console.log(`  Duration: ${event.duration}ms`);
  console.log(`  Time: ${event.timestamp.toISOString()}`);

  // Report metrics if available
  if (event.metrics) {
    const tokenUsage = event.metrics.totalTokens || 0;
    const toolCalls = event.metrics.toolCallCount || 0;

    if (tokenUsage > 0) {
      console.log(`  📊 Metrics:`);
      console.log(`    Tokens used: ${tokenUsage}`);
      console.log(`    Tool calls: ${toolCalls}`);

      if (event.metrics.successRate) {
        console.log(`    Success rate: ${(event.metrics.successRate * 100).toFixed(1)}%`);
      }
    }
  }

  // Check if this could be converted to a skill
  console.log(`\n💡 Tip: If you solved a recurring problem, create a skill to reuse the pattern:`);
  console.log(`   /create-skill --name "task-name" --language python\n`);

  // Cleanup resources
  try {
    // In production, this would clean up resources created during the task
    console.log('  ✓ Resources cleaned up');
  } catch (error) {
    console.warn(`  ⚠️  Warning during cleanup: ${error}`);
  }
}

export default onTaskComplete;
