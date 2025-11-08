# Implementation Roadmap

This document outlines the implementation plan to convert the MCP code execution framework from an educational template into a production-ready Claude Code marketplace plugin.

## Phase 1: Core MCP Client (Week 1-2)

### 1.1 Python MCP Client Implementation

**File:** `client/python.py`

**UPDATED TO USE OFFICIAL MCP SDK:**

Uses the official [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) instead of custom protocol implementation. This ensures:
- Compatibility with official spec
- Automatic updates with SDK
- Battle-tested error handling
- Community support

Wrapper implementation:

```python
import asyncio
import json
import subprocess
from typing import Any, Dict, Optional, AsyncIterator
from dataclasses import dataclass

@dataclass
class MCPError(Exception):
    """MCP protocol error"""
    code: int
    message: str

@dataclass
class ConnectionTimeout(Exception):
    """Connection timeout"""
    timeout_seconds: float

class MCPClient:
    def __init__(self, server: str, command: str, args: list, env: dict = None):
        self.server = server
        self.command = command
        self.args = args
        self.env = env or {}
        self.process: Optional[subprocess.Popen] = None
        self.request_id = 0
        self.pending_requests: Dict[int, asyncio.Future] = {}

    async def connect(self):
        """Start MCP server process"""
        self.process = subprocess.Popen(
            [self.command] + self.args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=self.env,
            text=True
        )
        # Start message listener
        asyncio.create_task(self._listen_responses())

    async def call_tool(
        self,
        tool: str,
        args: Dict[str, Any],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """Call MCP tool with timeout and retry logic"""
        self.request_id += 1
        request_id = self.request_id

        # Prepare request
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "tools/call",
            "params": {
                "name": tool,
                "arguments": args
            }
        }

        # Create future for response
        future: asyncio.Future = asyncio.Future()
        self.pending_requests[request_id] = future

        try:
            # Send request
            self.process.stdin.write(json.dumps(request) + "\n")
            self.process.stdin.flush()

            # Wait for response with timeout
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            raise ConnectionTimeout(timeout)
        finally:
            self.pending_requests.pop(request_id, None)

    async def _listen_responses(self):
        """Listen for and process MCP responses"""
        while self.process and self.process.poll() is None:
            try:
                line = self.process.stdout.readline()
                if not line:
                    break

                response = json.loads(line)
                request_id = response.get("id")

                if request_id in self.pending_requests:
                    future = self.pending_requests[request_id]

                    if "error" in response:
                        error = response["error"]
                        future.set_exception(MCPError(
                            error.get("code", -1),
                            error.get("message", "Unknown error")
                        ))
                    else:
                        future.set_result(response.get("result"))
            except Exception as e:
                print(f"Error listening to MCP server: {e}")
                break

    async def close(self):
        """Close connection"""
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=5)

# Global clients cache
_clients: Dict[str, MCPClient] = {}

async def get_client(
    server: str,
    command: str,
    args: list,
    env: dict = None
) -> MCPClient:
    """Get or create MCP client"""
    key = f"{server}:{command}"

    if key not in _clients:
        client = MCPClient(server, command, args, env)
        await client.connect()
        _clients[key] = client

    return _clients[key]

async def call_mcp_tool(
    server: str,
    tool: str,
    args: Dict[str, Any],
    mcp_config: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Call MCP tool through configured server

    Args:
        server: Server name (from mcp_config.json)
        tool: Tool name
        args: Tool arguments
        mcp_config: MCP configuration (loaded from file if not provided)

    Returns:
        Tool result

    Raises:
        MCPError: If tool call fails
        ConnectionTimeout: If call times out
    """
    if mcp_config is None:
        mcp_config = load_mcp_config()

    if server not in mcp_config.get("mcpServers", {}):
        raise ValueError(f"Unknown server: {server}")

    server_config = mcp_config["mcpServers"][server]
    client = await get_client(
        server,
        server_config["command"],
        server_config["args"],
        server_config.get("env", {})
    )

    return await client.call_tool(tool, args)

def load_mcp_config() -> Dict:
    """Load mcp_config.json"""
    import json
    from pathlib import Path

    config_file = Path.cwd() / "mcp_config.json"
    with open(config_file) as f:
        return json.load(f)
```

**Status:** To be implemented
**Effort:** 1-2 days
**Dependencies:** subprocess, asyncio, json

### 1.2 TypeScript MCP Client Implementation

**File:** `client/typescript.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class MCPError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
  }
}

export class ConnectionTimeout extends Error {
  constructor(public timeoutSeconds: number) {
    super(`Connection timeout after ${timeoutSeconds}s`);
  }
}

export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(
    private server: string,
    private config: MCPServerConfig
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args, {
          env: { ...process.env, ...this.config.env },
        });

        this.process.stdout?.on('data', (data) => {
          this.handleResponse(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          console.error(`[${this.server}] ${data}`);
        });

        this.process.on('error', reject);

        // Give server time to start
        setTimeout(resolve, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  async callTool<T = any>(
    tool: string,
    args: Record<string, any>,
    timeout: number = 30000
  ): Promise<T> {
    if (!this.process) {
      throw new Error('Client not connected');
    }

    this.requestId++;
    const requestId = this.requestId;

    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: args,
      },
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new ConnectionTimeout(timeout / 1000));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      this.process!.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  private handleResponse(data: string): void {
    const lines = data.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        const { id, error, result } = response;

        if (!id || !this.pendingRequests.has(id)) {
          continue;
        }

        const { resolve, reject, timeout } = this.pendingRequests.get(id)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(id);

        if (error) {
          reject(new MCPError(error.code || -1, error.message || 'Unknown error'));
        } else {
          resolve(result);
        }
      } catch (error) {
        console.error('Failed to parse MCP response:', error);
      }
    }
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      await new Promise((resolve) => {
        this.process!.on('exit', resolve);
        setTimeout(resolve, 5000);
      });
    }
  }
}

// Global client cache
const clientCache = new Map<string, MCPClient>();

export async function getOrCreateClient(
  server: string,
  config: MCPServerConfig
): Promise<MCPClient> {
  const key = `${server}:${config.command}`;

  if (!clientCache.has(key)) {
    const client = new MCPClient(server, config);
    await client.connect();
    clientCache.set(key, client);
  }

  return clientCache.get(key)!;
}

export async function callMCPTool<T = any>(
  server: string,
  tool: string,
  args: Record<string, any>,
  mcpConfig?: Record<string, any>
): Promise<T> {
  const config = mcpConfig || loadMCPConfig();

  if (!config.mcpServers[server]) {
    throw new Error(`Unknown server: ${server}`);
  }

  const serverConfig = config.mcpServers[server];
  const client = await getOrCreateClient(server, serverConfig);

  return client.callTool<T>(tool, args);
}

function loadMCPConfig(): Record<string, any> {
  // Implementation will load mcp_config.json
  throw new Error('Not implemented');
}
```

**Status:** To be implemented
**Effort:** 1-2 days
**Dependencies:** child_process, events

### 1.3 Error Classes and Utilities

**File:** `client/errors.py` (Python)

```python
class MCPException(Exception):
    """Base MCP exception"""
    pass

class MCPError(MCPException):
    """MCP protocol error with code"""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")

class ConnectionTimeout(MCPException):
    """Connection timed out"""
    def __init__(self, timeout_seconds: float):
        self.timeout_seconds = timeout_seconds
        super().__init__(f"Connection timeout after {timeout_seconds}s")

class ToolError(MCPException):
    """Tool execution error"""
    def __init__(self, tool: str, message: str):
        self.tool = tool
        super().__init__(f"Tool '{tool}' failed: {message}")
```

**Status:** Ready to implement
**Effort:** Few hours

## Phase 2: Server Wrapper Generator (Week 2-3)

### 2.1 Wrapper Generator Script

**File:** `scripts/generate_wrappers.py`

```python
"""
Generate server wrapper modules from MCP server definitions
"""
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List

def get_server_tools(server_name: str, command: str, args: List[str]) -> Dict[str, Any]:
    """Get available tools from MCP server"""
    # Start server and get tool definitions
    # Return structured tool list
    pass

def generate_python_wrapper(server_name: str, tools: Dict[str, Any]) -> None:
    """Generate Python wrapper modules"""
    py_dir = Path(f"servers/python/{server_name}")
    py_dir.mkdir(parents=True, exist_ok=True)

    # Generate __init__.py
    # Generate tool_*.py modules
    # Add type hints
    pass

def generate_typescript_wrapper(server_name: str, tools: Dict[str, Any]) -> None:
    """Generate TypeScript wrapper modules"""
    ts_dir = Path(f"servers/typescript/{server_name_camelcase}")
    ts_dir.mkdir(parents=True, exist_ok=True)

    # Generate index.ts
    # Generate tool*.ts modules
    # Add types
    pass

def main():
    """Generate wrappers for all configured servers"""
    with open('mcp_config.json') as f:
        config = json.load(f)

    for server_name, server_config in config['mcpServers'].items():
        print(f"Generating wrappers for {server_name}...")

        # Get tools
        tools = get_server_tools(
            server_name,
            server_config['command'],
            server_config['args']
        )

        # Generate wrappers
        generate_python_wrapper(server_name, tools)
        generate_typescript_wrapper(server_name, tools)

        print(f"✓ Generated {server_name} wrappers")
```

**Status:** To be implemented
**Effort:** 2 days
**Dependencies:** subprocess, json, pathlib

### 2.2 Example Generated Wrapper

**File:** `servers/python/filesystem/read_file.py` (example)

```python
"""
Read file from filesystem

Part of auto-generated MCP wrappers.
Generated from @modelcontextprotocol/server-filesystem
"""

from typing import Any, Dict, Optional
from client.python import call_mcp_tool

async def read_file(
    path: str,
    encoding: str = 'utf-8'
) -> Dict[str, Any]:
    """
    Read file contents from the filesystem.

    Args:
        path: File path to read
        encoding: Text encoding (default: utf-8)

    Returns:
        Dictionary with 'content' and 'encoding' keys

    Raises:
        ToolError: If file cannot be read
    """
    return await call_mcp_tool(
        'filesystem',
        'read_file',
        {
            'path': path,
            'encoding': encoding
        }
    )
```

**Status:** Template for generation
**Effort:** Included in generator implementation

## Phase 3: Skill Registry System (Week 3)

### 3.1 Skill Registry

**File:** `skills/__init__.py`

```python
"""
Skill registry and discovery system
"""

from pathlib import Path
from typing import Dict, List, Optional
import json
import importlib

SKILL_METADATA = {
    'extract_action_items': {
        'name': 'Extract Action Items',
        'module': 'extract_action_items',
        'language': 'python',
        'version': '1.0.0',
        'description': 'Extract action items from text based on common prefixes',
        'tags': ['text-processing', 'document-analysis'],
        'dependencies': [],
        'example': '''
from skills.python.extract_action_items import extract_action_items

text = "ACTION: Follow up with client\\nTODO: Update proposal"
items = extract_action_items(text)
print(items)  # ['ACTION: Follow up with client', 'TODO: Update proposal']
'''
    },
    'filter_large_dataset': {
        'name': 'Filter Large Dataset',
        'module': 'example_data_filter',
        'language': 'python',
        'version': '1.0.0',
        'description': 'Filter large datasets in execution environment for token efficiency',
        'tags': ['data-processing', 'filtering'],
        'dependencies': [],
        'example': '''
from skills.python.example_data_filter import filter_large_dataset

data = [{'status': 'active', 'value': 100}, {'status': 'inactive', 'value': 50}]
filtered = await filter_large_dataset(data, 'status', 'active')
'''
    }
}

class Skill:
    """Represents a reusable skill"""

    def __init__(self, name: str, metadata: Dict):
        self.name = name
        self.metadata = metadata

    def load(self):
        """Load skill module"""
        module_name = f"skills.{self.metadata['language']}.{self.metadata['module']}"
        return importlib.import_module(module_name)

    def get_functions(self) -> List[str]:
        """Get available functions in skill"""
        module = self.load()
        return [name for name in dir(module) if not name.startswith('_')]

def list_skills(
    language: Optional[str] = None,
    tag: Optional[str] = None
) -> List[Skill]:
    """
    List available skills with optional filtering

    Args:
        language: Filter by language ('python' or 'typescript')
        tag: Filter by tag

    Returns:
        List of skills
    """
    skills = []

    for name, metadata in SKILL_METADATA.items():
        if language and metadata['language'] != language:
            continue

        if tag and tag not in metadata.get('tags', []):
            continue

        skills.append(Skill(name, metadata))

    return skills

def get_skill(name: str) -> Optional[Skill]:
    """Get skill by name"""
    if name in SKILL_METADATA:
        return Skill(name, SKILL_METADATA[name])
    return None

def search_skills(query: str) -> List[Skill]:
    """Search skills by name or tag"""
    query_lower = query.lower()
    results = []

    for name, metadata in SKILL_METADATA.items():
        if (query_lower in name or
            query_lower in metadata['description'].lower() or
            any(query_lower in tag for tag in metadata.get('tags', []))):
            results.append(Skill(name, metadata))

    return results
```

**Status:** Ready to implement
**Effort:** 1 day

### 3.2 Skill CLI Commands

**File:** `cli/skills.py`

```python
"""
CLI commands for skill management
"""

import asyncio
from skills import list_skills, get_skill, search_skills

async def list_command(language: str = None):
    """List available skills"""
    skills = list_skills(language=language)

    print(f"\nAvailable Skills ({len(skills)} total)\n")

    for skill in skills:
        meta = skill.metadata
        print(f"  {skill.name}")
        print(f"    Description: {meta['description']}")
        print(f"    Language: {meta['language']} v{meta['version']}")
        print(f"    Tags: {', '.join(meta.get('tags', []))}")
        print()

async def search_command(query: str):
    """Search skills"""
    results = search_skills(query)

    if not results:
        print(f"No skills found matching '{query}'")
        return

    print(f"\nSearch Results ({len(results)} found)\n")
    for skill in results:
        meta = skill.metadata
        print(f"  {skill.name}: {meta['description']}")

async def info_command(name: str):
    """Get detailed skill information"""
    skill = get_skill(name)

    if not skill:
        print(f"Skill '{name}' not found")
        return

    meta = skill.metadata
    print(f"\n{meta['name']}")
    print(f"{'='*50}")
    print(f"Description: {meta['description']}")
    print(f"Language: {meta['language']} v{meta['version']}")
    print(f"Tags: {', '.join(meta.get('tags', []))}")
    print(f"\nExample:\n{meta['example']}")
```

**Status:** Ready to implement
**Effort:** Few hours

## Phase 4: Error Handling & Resilience (Week 3-4)

### 4.1 Retry with Exponential Backoff

**File:** `client/retry.py`

```python
"""
Retry logic with exponential backoff
"""

import asyncio
import random
from typing import Callable, TypeVar, Optional
from client.errors import MCPException, ConnectionTimeout

T = TypeVar('T')

async def call_with_retry(
    func: Callable[..., T],
    *args,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
    **kwargs
) -> T:
    """
    Call function with exponential backoff retry

    Args:
        func: Async function to call
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        jitter: Add random jitter to delays

    Returns:
        Function result

    Raises:
        MCPException: If all retries exhausted
    """
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except (ConnectionTimeout, TimeoutError) as e:
            last_error = e

            if attempt == max_retries:
                raise

            # Calculate delay with exponential backoff
            delay = min(base_delay * (2 ** attempt), max_delay)

            # Add jitter
            if jitter:
                delay *= (0.5 + random.random())

            print(f"Attempt {attempt + 1}/{max_retries + 1} failed: {e}")
            print(f"Retrying in {delay:.1f}s...")

            await asyncio.sleep(delay)
        except MCPException:
            # Don't retry on other MCP errors
            raise

    raise last_error
```

**Status:** Ready to implement
**Effort:** Few hours

### 4.2 Result Caching

**File:** `client/cache.py`

```python
"""
Result caching for expensive operations
"""

import hashlib
import json
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

class CacheEntry:
    def __init__(self, value: Any, ttl: Optional[float] = None):
        self.value = value
        self.created_at = datetime.now()
        self.ttl = ttl

    def is_expired(self) -> bool:
        if self.ttl is None:
            return False
        age = (datetime.now() - self.created_at).total_seconds()
        return age > self.ttl

class ToolCache:
    """Cache for MCP tool results"""

    def __init__(self, max_size: int = 1000, default_ttl: Optional[float] = 3600):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl

    def _make_key(self, server: str, tool: str, args: Dict) -> str:
        """Create cache key from server, tool, and arguments"""
        key_str = f"{server}:{tool}:{json.dumps(args, sort_keys=True)}"
        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, server: str, tool: str, args: Dict) -> Optional[Any]:
        """Get cached result"""
        key = self._make_key(server, tool, args)

        if key not in self.cache:
            return None

        entry = self.cache[key]
        if entry.is_expired():
            del self.cache[key]
            return None

        return entry.value

    def set(self, server: str, tool: str, args: Dict, value: Any, ttl: Optional[float] = None):
        """Cache result"""
        if len(self.cache) >= self.max_size:
            # Remove oldest entry
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k].created_at)
            del self.cache[oldest_key]

        key = self._make_key(server, tool, args)
        ttl = ttl or self.default_ttl
        self.cache[key] = CacheEntry(value, ttl)

    def clear(self):
        """Clear all cache"""
        self.cache.clear()

# Global cache instance
_cache = ToolCache()

def cache_tool_call(ttl: Optional[float] = None):
    """Decorator for caching tool results"""
    def decorator(func):
        async def wrapper(server: str, tool: str, args: Dict, *a, **kw):
            cached = _cache.get(server, tool, args)
            if cached is not None:
                print(f"Cache hit: {server}/{tool}")
                return cached

            result = await func(server, tool, args, *a, **kw)
            _cache.set(server, tool, args, result, ttl)
            return result

        return wrapper
    return decorator
```

**Status:** Ready to implement
**Effort:** 1 day

## Phase 5: Security & Monitoring (Week 4)

### 5.1 Security Policies

**File:** `security/policies.py`

```python
"""
Security policies for MCP execution
"""

import logging
from typing import Dict, List, Set
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger('mcp.security')

class SecurityPolicy:
    """Base security policy"""

    def validate(self, context: Dict) -> bool:
        """Validate operation against policy"""
        raise NotImplementedError

class WorkspacePolicy(SecurityPolicy):
    """Ensure filesystem access is limited to workspace"""

    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root.resolve()

    def validate(self, context: Dict) -> bool:
        """Check if file path is within workspace"""
        file_path = Path(context.get('path', '')).resolve()

        try:
            file_path.relative_to(self.workspace_root)
            return True
        except ValueError:
            logger.warning(f"Attempted access outside workspace: {file_path}")
            return False

class RateLimitPolicy(SecurityPolicy):
    """Rate limit tool calls per server"""

    def __init__(self, calls_per_minute: int = 60):
        self.calls_per_minute = calls_per_minute
        self.call_history: Dict[str, List[float]] = {}

    def validate(self, context: Dict) -> bool:
        """Check if rate limit exceeded"""
        import time

        server = context.get('server')
        now = time.time()

        if server not in self.call_history:
            self.call_history[server] = []

        # Remove calls older than 1 minute
        self.call_history[server] = [
            t for t in self.call_history[server]
            if now - t < 60
        ]

        if len(self.call_history[server]) >= self.calls_per_minute:
            logger.warning(f"Rate limit exceeded for {server}")
            return False

        self.call_history[server].append(now)
        return True

class SensitiveDataPolicy(SecurityPolicy):
    """Prevent logging sensitive data"""

    SENSITIVE_KEYS = {
        'password', 'token', 'secret', 'key', 'api_key',
        'private_key', 'access_token', 'refresh_token'
    }

    def validate(self, context: Dict) -> bool:
        """Check if context contains sensitive data"""
        for key in context.keys():
            if any(s in key.lower() for s in self.SENSITIVE_KEYS):
                logger.warning(f"Sensitive data detected in context: {key}")
                return False

        return True

    @staticmethod
    def sanitize(data: Dict) -> Dict:
        """Remove sensitive values from data"""
        sanitized = {}
        for key, value in data.items():
            if any(s in key.lower() for s in SensitiveDataPolicy.SENSITIVE_KEYS):
                sanitized[key] = '***REDACTED***'
            else:
                sanitized[key] = value
        return sanitized
```

**Status:** Ready to implement
**Effort:** 1 day

### 5.2 Monitoring & Metrics

**File:** `monitoring/metrics.py`

```python
"""
Performance monitoring and metrics collection
"""

from dataclasses import dataclass, field
from typing import Dict, List
from datetime import datetime
import json

@dataclass
class ToolCallMetrics:
    """Metrics for a tool call"""
    server: str
    tool: str
    duration_ms: float
    tokens_input: int = 0
    tokens_output: int = 0
    success: bool = True
    error: str = None
    timestamp: datetime = field(default_factory=datetime.now)

    @property
    def tokens_total(self) -> int:
        return self.tokens_input + self.tokens_output

    def to_dict(self) -> Dict:
        return {
            'server': self.server,
            'tool': self.tool,
            'duration_ms': self.duration_ms,
            'tokens_input': self.tokens_input,
            'tokens_output': self.tokens_output,
            'tokens_total': self.tokens_total,
            'success': self.success,
            'error': self.error,
            'timestamp': self.timestamp.isoformat()
        }

class MetricsCollector:
    """Collect and analyze metrics"""

    def __init__(self):
        self.calls: List[ToolCallMetrics] = []
        self.start_time = datetime.now()

    def record(self, metrics: ToolCallMetrics):
        """Record tool call metrics"""
        self.calls.append(metrics)

    def get_summary(self) -> Dict:
        """Get metrics summary"""
        if not self.calls:
            return {}

        successful = [c for c in self.calls if c.success]
        failed = [c for c in self.calls if not c.success]

        total_duration = sum(c.duration_ms for c in self.calls)
        total_tokens = sum(c.tokens_total for c in self.calls)

        return {
            'total_calls': len(self.calls),
            'successful': len(successful),
            'failed': len(failed),
            'success_rate': len(successful) / len(self.calls) * 100 if self.calls else 0,
            'total_duration_ms': total_duration,
            'avg_duration_ms': total_duration / len(self.calls) if self.calls else 0,
            'total_tokens': total_tokens,
            'avg_tokens_per_call': total_tokens / len(self.calls) if self.calls else 0,
            'elapsed_seconds': (datetime.now() - self.start_time).total_seconds()
        }

    def export_json(self, filepath: str):
        """Export metrics to JSON"""
        data = {
            'calls': [c.to_dict() for c in self.calls],
            'summary': self.get_summary()
        }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)

# Global metrics collector
_metrics = MetricsCollector()

def get_metrics_collector() -> MetricsCollector:
    """Get global metrics collector"""
    return _metrics
```

**Status:** Ready to implement
**Effort:** 1 day

## Phase 6: Claude Code Plugin (Week 4-5)

### 6.1 Plugin Manifest

**File:** `plugin.json`

```json
{
  "name": "MCP Code Execution",
  "version": "1.0.0",
  "description": "Token-efficient MCP server interaction through code execution. Achieve 95-99% token reduction on data-heavy tasks.",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/yourusername/mcp-code-execution",
  "commands": [
    {
      "name": "setup-mcp",
      "description": "Initialize MCP workspace with server configuration",
      "file": "plugin/commands/setupMCP.ts"
    },
    {
      "name": "generate-wrappers",
      "description": "Generate Python/TypeScript server wrappers from MCP server definitions",
      "file": "plugin/commands/generateWrappers.ts"
    },
    {
      "name": "list-skills",
      "description": "List available reusable skills",
      "file": "plugin/commands/listSkills.ts"
    }
  ],
  "agents": [
    {
      "name": "task-executor",
      "description": "Execute MCP tasks with token efficiency optimization",
      "file": "plugin/agents/taskExecutor.ts"
    }
  ],
  "hooks": [
    {
      "event": "task.execute",
      "file": "plugin/hooks/taskHook.ts"
    }
  ],
  "skills": [
    {
      "name": "data-processing",
      "description": "Data processing and filtering skills",
      "file": "plugin/skills/dataProcessing.ts"
    }
  ]
}
```

**Status:** Ready to implement
**Effort:** Few hours

### 6.2 Plugin Commands

**File:** `plugin/commands/setupMCP.ts`

```typescript
/**
 * Command: Setup MCP workspace
 * Initializes MCP configuration and creates directory structure
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function setupMCP(config: {
  servers: string[];
  workspace?: string;
} = { servers: [], workspace: 'workspace' }) {
  console.log('🚀 Setting up MCP Code Execution workspace...\n');

  // Create directory structure
  const dirs = [
    config.workspace,
    'servers/python',
    'servers/typescript',
    'skills/python',
    'skills/typescript',
    'client'
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created ${dir}/`);
  }

  // Create mcp_config.json if not exists
  const configPath = path.join(process.cwd(), 'mcp_config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', config.workspace]
        }
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✓ Created mcp_config.json');
  }

  // Install dependencies
  console.log('\n📦 Installing dependencies...');
  try {
    execSync('uv sync', { stdio: 'inherit' });
    execSync('bun install', { stdio: 'inherit' });
    console.log('✓ Dependencies installed');
  } catch (error) {
    console.warn('⚠️  Could not install dependencies (uv/bun may be needed)');
  }

  console.log('\n✅ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Edit mcp_config.json to add your MCP servers');
  console.log('2. Run: /generate-wrappers');
  console.log('3. Create your first task using the code execution pattern');
}
```

**Status:** Ready to implement
**Effort:** 1 day

## Timeline Summary

| Phase | Duration | Components | Status |
|-------|----------|-----------|---------|
| 1 | Weeks 1-2 | MCP Clients (Python + TS) | To Implement |
| 2 | Weeks 2-3 | Server Wrapper Generator | To Implement |
| 3 | Week 3 | Skill Registry System | To Implement |
| 4 | Weeks 3-4 | Error Handling & Retry | To Implement |
| 5 | Week 4 | Security & Monitoring | To Implement |
| 6 | Weeks 4-5 | Plugin Structure & Commands | To Implement |

**Total Effort:** 4-5 weeks (full-time equivalent)

## Success Criteria

- ✅ MCP clients connect to and communicate with real servers
- ✅ Server wrappers auto-generate from MCP definitions
- ✅ Skill registry lists, searches, and loads skills
- ✅ Error handling with retries works reliably
- ✅ Monitoring captures performance metrics
- ✅ Plugin submits to Claude Code marketplace
- ✅ 95-99% token reduction demonstrated in benchmarks
- ✅ Examples and documentation complete

## Testing Strategy

- Unit tests for client protocol
- Integration tests for server connection
- End-to-end tests with real MCP servers
- Performance benchmarks (token usage)
- Security policy validation tests
- Plugin installation and activation tests

---

**Status:** Planning Phase ✅
**Next Step:** Begin Phase 1 implementation
**Owner:** Development Team
