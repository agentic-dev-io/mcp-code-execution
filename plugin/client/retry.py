"""
Retry logic with exponential backoff for MCP tool calls

Implements resilient execution patterns with:
- Exponential backoff with jitter
- Configurable retry counts and delays
- Timeout handling
- Error classification
"""

import asyncio
import random
import logging
from typing import Callable, TypeVar, Optional, Type, Tuple
from client.python import MCPException, ConnectionTimeout

logger = logging.getLogger(__name__)

T = TypeVar('T')

# Errors that should trigger a retry
RETRYABLE_ERRORS = (ConnectionTimeout, TimeoutError, ConnectionError)

# Errors that should NOT be retried
NON_RETRYABLE_ERRORS = (ValueError, KeyError, FileNotFoundError)


class RetryConfig:
    """Configuration for retry behavior"""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        retryable_errors: Tuple = RETRYABLE_ERRORS
    ):
        """
        Args:
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds (doubled after each retry)
            max_delay: Maximum delay in seconds
            exponential_base: Base for exponential backoff (default 2.0)
            jitter: Add random jitter to delays to avoid thundering herd
            retryable_errors: Tuple of exception types to retry on
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.retryable_errors = retryable_errors

    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number"""
        delay = min(
            self.base_delay * (self.exponential_base ** attempt),
            self.max_delay
        )

        if self.jitter:
            # Add random jitter: ±20%
            jitter_factor = 0.8 + random.random() * 0.4
            delay *= jitter_factor

        return delay


async def call_with_retry(
    func: Callable,
    *args,
    config: Optional[RetryConfig] = None,
    **kwargs
) -> T:
    """
    Call async function with exponential backoff retry

    Args:
        func: Async function to call
        config: RetryConfig object (uses defaults if None)
        *args, **kwargs: Arguments to pass to func

    Returns:
        Function result

    Raises:
        Exception: If all retries exhausted or error is non-retryable

    Example:
        >>> from client.retry import call_with_retry, RetryConfig
        >>> from client.python import call_mcp_tool
        >>>
        >>> config = RetryConfig(max_retries=3, base_delay=1.0)
        >>> result = await call_with_retry(
        ...     call_mcp_tool,
        ...     'google-drive',
        ...     'get_document',
        ...     {'document_id': 'abc123'},
        ...     config=config
        ... )
    """
    if config is None:
        config = RetryConfig()

    last_error = None

    for attempt in range(config.max_retries + 1):
        try:
            return await func(*args, **kwargs)

        except config.retryable_errors as e:
            last_error = e

            if attempt == config.max_retries:
                logger.error(f"All retry attempts exhausted for {func.__name__}")
                raise

            delay = config.calculate_delay(attempt)
            logger.warning(
                f"Attempt {attempt + 1}/{config.max_retries + 1} failed with {type(e).__name__}: {e}"
            )
            logger.info(f"Retrying in {delay:.2f}s...")
            await asyncio.sleep(delay)

        except Exception as e:
            # Non-retryable error
            logger.error(f"Non-retryable error in {func.__name__}: {e}")
            raise

    # Should not reach here, but just in case
    raise last_error or RuntimeError("Unknown error after retries")


async def call_mcp_tool_with_retry(
    server: str,
    tool: str,
    args: dict,
    config: Optional[RetryConfig] = None
):
    """
    Call MCP tool with automatic retries

    Convenience function that combines call_mcp_tool with retry logic

    Args:
        server: MCP server name
        tool: Tool name
        args: Tool arguments
        config: RetryConfig (uses defaults if None)

    Returns:
        Tool result

    Example:
        >>> result = await call_mcp_tool_with_retry(
        ...     'google-drive',
        ...     'get_document',
        ...     {'document_id': 'abc123'}
        ... )
    """
    from client.python import call_mcp_tool

    return await call_with_retry(
        call_mcp_tool,
        server,
        tool,
        args,
        config=config
    )


# Default config for convenience
DEFAULT_CONFIG = RetryConfig()
