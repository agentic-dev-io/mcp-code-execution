"""
MCP Client for Python Code Execution

Uses the official MCP Python SDK to communicate with MCP servers.
Documentation: https://github.com/modelcontextprotocol/python-sdk

Usage in server wrappers:
    from client.python import call_mcp_tool

    result = await call_mcp_tool('server_name', 'tool_name', {'param': 'value'})

Features:
    - Built on official MCP SDK
    - Automatic server process management
    - Async/await support
    - Error handling with retries
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import StdioClient

logger = logging.getLogger(__name__)


# ============================================================================
# Exception Classes
# ============================================================================

class MCPException(Exception):
    """Base MCP exception"""
    pass


class MCPError(MCPException):
    """MCP protocol error"""

    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"[{code}] {message}")


class ConnectionTimeout(MCPException):
    """Connection timed out"""

    def __init__(self, timeout_seconds: float):
        self.timeout_seconds = timeout_seconds
        super().__init__(f"Connection timeout after {timeout_seconds}s")


class ConnectionError(MCPException):
    """Connection error"""

    def __init__(self, server: str, message: str):
        self.server = server
        super().__init__(f"Connection to {server} failed: {message}")


class ToolError(MCPException):
    """Tool execution error"""

    def __init__(self, tool: str, message: str):
        self.tool = tool
        super().__init__(f"Tool '{tool}' failed: {message}")


# ============================================================================
# MCP Client Wrapper
# ============================================================================

class MCPClientWrapper:
    """Wrapper around official MCP SDK client"""

    def __init__(self, server: str, command: str, args: list, env: Dict = None):
        """
        Initialize MCP client

        Args:
            server: Server name for logging
            command: Command to execute (e.g., 'npx')
            args: Command arguments
            env: Environment variables
        """
        self.server = server
        self.command = command
        self.args = args
        self.env = env or {}
        self.session: Optional[ClientSession] = None
        self.stdio_client: Optional[StdioClient] = None
        self.connected = False

    async def connect(self, timeout: float = 10.0) -> None:
        """
        Start MCP server process and establish connection

        Args:
            timeout: Connection timeout in seconds

        Raises:
            ConnectionError: If connection fails
        """
        try:
            logger.info(f"Connecting to {self.server}: {self.command} {' '.join(self.args)}")

            # Create stdio client using official SDK
            params = StdioServerParameters(
                command=self.command,
                args=self.args,
                env=self.env
            )

            self.stdio_client = StdioClient(params)

            # Connect with timeout
            try:
                self.session = await asyncio.wait_for(
                    self.stdio_client.start(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                await self.close()
                raise ConnectionError(self.server, "Connection timeout")

            self.connected = True
            logger.info(f"Connected to {self.server}")

        except Exception as e:
            await self.close()
            if isinstance(e, ConnectionError):
                raise
            raise ConnectionError(self.server, str(e))

    async def call_tool(
        self,
        tool: str,
        args: Dict[str, Any],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Call MCP tool using official SDK

        Args:
            tool: Tool name
            args: Tool arguments
            timeout: Call timeout in seconds

        Returns:
            Tool result

        Raises:
            MCPError: If tool call fails
            ConnectionTimeout: If call times out
        """
        if not self.connected or not self.session:
            raise ConnectionError(self.server, "Not connected")

        try:
            logger.debug(f"→ {self.server}/{tool}: {args}")

            # Use the official SDK to call tool
            result = await asyncio.wait_for(
                self.session.call_tool(tool, args),
                timeout=timeout
            )

            logger.debug(f"← {self.server}/{tool}: success")
            return result

        except asyncio.TimeoutError:
            raise ConnectionTimeout(timeout)
        except Exception as e:
            logger.error(f"Tool call failed: {e}")
            raise MCPError(
                code=-1,
                message=str(e)
            )

    async def close(self) -> None:
        """Close connection"""
        logger.info(f"Closing connection to {self.server}")

        self.connected = False

        if self.session:
            try:
                await self.session.aclose()
            except Exception as e:
                logger.warning(f"Error closing session: {e}")

        if self.stdio_client:
            try:
                await self.stdio_client.aclose()
            except Exception as e:
                logger.warning(f"Error closing stdio client: {e}")

        self.session = None
        self.stdio_client = None


# ============================================================================
# Global Client Management
# ============================================================================

_clients: Dict[str, MCPClientWrapper] = {}


def load_mcp_config() -> Dict[str, Any]:
    """Load mcp_config.json from current directory"""
    config_file = Path.cwd() / "mcp_config.json"

    if not config_file.exists():
        raise FileNotFoundError(f"mcp_config.json not found in {Path.cwd()}")

    with open(config_file) as f:
        return json.load(f)


async def get_or_create_client(
    server: str,
    command: str,
    args: list,
    env: Dict = None
) -> MCPClientWrapper:
    """
    Get existing client or create new one

    Args:
        server: Server name
        command: Command to execute
        args: Command arguments
        env: Environment variables

    Returns:
        MCP client
    """
    key = f"{server}:{command}"

    if key not in _clients:
        client = MCPClientWrapper(server, command, args, env)
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
    Call MCP tool using official SDK

    Args:
        server: Server name (from mcp_config.json)
        tool: Tool name
        args: Tool arguments
        mcp_config: MCP configuration (loaded from file if not provided)

    Returns:
        Tool result

    Raises:
        MCPError: If tool call fails
        ConnectionError: If connection fails
        ConnectionTimeout: If call times out
        FileNotFoundError: If mcp_config.json not found

    Example:
        >>> result = await call_mcp_tool(
        ...     'google-drive',
        ...     'get_document',
        ...     {'document_id': 'abc123'}
        ... )
    """
    if mcp_config is None:
        mcp_config = load_mcp_config()

    servers = mcp_config.get("mcpServers", {})
    if server not in servers:
        raise ValueError(f"Unknown server: {server}. Available: {list(servers.keys())}")

    server_config = servers[server]
    client = await get_or_create_client(
        server,
        server_config["command"],
        server_config["args"],
        server_config.get("env", {})
    )

    return await client.call_tool(tool, args)


async def cleanup_clients() -> None:
    """Close all client connections"""
    logger.info("Cleaning up MCP clients...")
    for client in _clients.values():
        await client.close()
    _clients.clear()


# ============================================================================
# Cleanup on exit
# ============================================================================

import atexit


def _cleanup_on_exit():
    """Cleanup clients on program exit"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(cleanup_clients())
        else:
            loop.run_until_complete(cleanup_clients())
    except Exception:
        pass


atexit.register(_cleanup_on_exit)
