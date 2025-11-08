/**
 * On Task Start Hook
 *
 * Executes before a task starts.
 * Used for setup, validation, and metrics initialization.
 */

interface TaskStartEvent {
  taskId: string;
  description: string;
  servers: string[];
  timestamp: Date;
}

export async function onTaskStart(event: TaskStartEvent): Promise<void> {
  console.log(`\n[Hook] Task starting: ${event.taskId}`);
  console.log(`  Description: ${event.description}`);
  console.log(`  Servers: ${event.servers.join(', ')}`);
  console.log(`  Time: ${event.timestamp.toISOString()}`);

  // Pre-task validation
  try {
    // Check if all servers are configured
    const configPath = './mcp_config.json';
    const config = require(configPath);

    for (const serverName of event.servers) {
      if (!config.mcpServers[serverName]) {
        throw new Error(`Server not configured: ${serverName}`);
      }
    }

    console.log('  ✓ All servers configured');
  } catch (error) {
    console.warn(`  ⚠️  Warning: ${error}`);
  }

  // Initialize metrics collection
  try {
    const { getMetricsCollector } = require('../client/monitoring.js');
    const collector = getMetricsCollector();
    collector.startSession(event.taskId);
    console.log('  ✓ Metrics collection initialized');
  } catch (error) {
    // Metrics might not be available - that's ok
  }

  console.log('');
}

export default onTaskStart;
