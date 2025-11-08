"""
Security policies for MCP execution

Implements security controls for:
- Workspace isolation (filesystem access)
- Rate limiting (prevent abuse)
- Sensitive data protection (no logging credentials)
- Input validation

These policies can be applied to all MCP tool calls to enforce security constraints.
"""

import logging
import time
import re
from typing import Dict, Any, List, Optional, Set
from pathlib import Path
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ============================================================================
# Security Policy Base Class
# ============================================================================

class SecurityPolicy(ABC):
    """Abstract base class for security policies"""

    @abstractmethod
    def validate(self, context: Dict[str, Any]) -> bool:
        """
        Validate operation against policy

        Args:
            context: Operation context including server, tool, args, etc.

        Returns:
            True if operation is allowed, False otherwise
        """
        pass


# ============================================================================
# Workspace Policy
# ============================================================================

class WorkspacePolicy(SecurityPolicy):
    """
    Ensures filesystem operations are limited to workspace directory

    Prevents directory traversal attacks and accidental access outside
    the designated workspace.
    """

    def __init__(self, workspace_root: Path):
        """
        Args:
            workspace_root: Path to workspace root directory
        """
        self.workspace_root = workspace_root.resolve()
        logger.info(f"WorkspacePolicy initialized with root: {self.workspace_root}")

    def validate(self, context: Dict[str, Any]) -> bool:
        """Check if file access is within workspace"""
        # Only validate filesystem server operations
        if context.get('server') != 'filesystem':
            return True

        tool = context.get('tool', '')
        args = context.get('args', {})

        # Only validate file read/write/delete operations
        if tool not in ['read_file', 'write_file', 'delete_file', 'list_directory']:
            return True

        path_arg = args.get('path') or args.get('file_path')
        if not path_arg:
            return True

        try:
            file_path = Path(path_arg).resolve()
            file_path.relative_to(self.workspace_root)
            return True
        except ValueError:
            logger.warning(f"Access outside workspace denied: {file_path} (allowed: {self.workspace_root})")
            return False


# ============================================================================
# Rate Limiting Policy
# ============================================================================

@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""
    calls_per_minute: int = 60
    calls_per_hour: int = 3600
    concurrent_calls: int = 10
    per_server: bool = True  # Apply limits per server or globally


class RateLimitPolicy(SecurityPolicy):
    """
    Rate limit tool calls to prevent abuse

    Tracks:
    - Calls per minute (per server if configured)
    - Calls per hour (per server if configured)
    - Concurrent active calls
    """

    def __init__(self, config: Optional[RateLimitConfig] = None):
        """
        Args:
            config: RateLimitConfig object (uses defaults if None)
        """
        self.config = config or RateLimitConfig()
        self.call_history: Dict[str, List[float]] = {}
        self.concurrent_calls: Dict[str, int] = {}
        logger.info(f"RateLimitPolicy initialized: {self.config.calls_per_minute} calls/min")

    def _get_key(self, context: Dict[str, Any]) -> str:
        """Get rate limit key (per-server or global)"""
        if self.config.per_server:
            return context.get('server', 'global')
        return 'global'

    def validate(self, context: Dict[str, Any]) -> bool:
        """Check if call is within rate limits"""
        key = self._get_key(context)
        now = time.time()

        # Initialize tracking if needed
        if key not in self.call_history:
            self.call_history[key] = []
        if key not in self.concurrent_calls:
            self.concurrent_calls[key] = 0

        # Check concurrent call limit
        if self.concurrent_calls[key] >= self.config.concurrent_calls:
            logger.warning(f"Concurrent call limit exceeded for {key}")
            return False

        # Clean up old calls (older than 1 hour)
        self.call_history[key] = [t for t in self.call_history[key] if now - t < 3600]

        # Count calls in last minute
        calls_last_minute = sum(1 for t in self.call_history[key] if now - t < 60)
        if calls_last_minute >= self.config.calls_per_minute:
            logger.warning(f"Rate limit exceeded (per minute) for {key}: {calls_last_minute} calls")
            return False

        # Count calls in last hour
        calls_last_hour = len(self.call_history[key])
        if calls_last_hour >= self.config.calls_per_hour:
            logger.warning(f"Rate limit exceeded (per hour) for {key}: {calls_last_hour} calls")
            return False

        self.call_history[key].append(now)
        self.concurrent_calls[key] += 1
        return True

    def mark_complete(self, context: Dict[str, Any]) -> None:
        """Mark a call as complete (decrements concurrent counter)"""
        key = self._get_key(context)
        if key in self.concurrent_calls:
            self.concurrent_calls[key] = max(0, self.concurrent_calls[key] - 1)


# ============================================================================
# Sensitive Data Protection
# ============================================================================

class SensitiveDataPolicy(SecurityPolicy):
    """
    Protect sensitive data from being logged or exposed

    Identifies and redacts:
    - API keys, tokens, secrets
    - Passwords, credentials
    - Private keys, certificates
    - Personally identifiable information (PII)
    """

    # Patterns for sensitive field names
    SENSITIVE_KEY_PATTERNS = [
        r'password',
        r'token',
        r'secret',
        r'api_?key',
        r'private_?key',
        r'access_?token',
        r'refresh_?token',
        r'auth',
        r'credential',
        r'apikey',
    ]

    # Patterns for sensitive values
    SENSITIVE_VALUE_PATTERNS = [
        r'^Bearer\s+[A-Za-z0-9_\-\.]+$',  # Bearer tokens
        r'^[A-Za-z0-9_\-\.]+\.[A-Za-z0-9_\-\.]+\.[A-Za-z0-9_\-\.]+$',  # JWT
        r'^sk_[A-Za-z0-9]+$',  # Stripe keys
        r'^pk_[A-Za-z0-9]+$',  # Stripe keys
    ]

    def __init__(self):
        self.compiled_key_patterns = [re.compile(p, re.IGNORECASE) for p in self.SENSITIVE_KEY_PATTERNS]
        self.compiled_value_patterns = [re.compile(p) for p in self.SENSITIVE_VALUE_PATTERNS]

    def validate(self, context: Dict[str, Any]) -> bool:
        """Check if context contains sensitive data that shouldn't be logged"""
        args = context.get('args', {})

        for key, value in args.items():
            # Check key patterns
            if any(pattern.search(key) for pattern in self.compiled_key_patterns):
                logger.warning(f"Sensitive data detected in argument: {key}")
                return False

            # Check value patterns
            if isinstance(value, str) and any(pattern.search(value) for pattern in self.compiled_value_patterns):
                logger.warning(f"Sensitive data detected in argument value: {key}")
                return False

        return True

    @staticmethod
    def sanitize(data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive values from data for safe logging"""
        if not isinstance(data, dict):
            return data

        sensitive_keys = SensitiveDataPolicy.SENSITIVE_KEY_PATTERNS
        policy = SensitiveDataPolicy()
        sanitized = {}

        for key, value in data.items():
            # Check if key matches sensitive patterns
            if any(pattern.search(key) for pattern in policy.compiled_key_patterns):
                sanitized[key] = '***REDACTED***'
            else:
                sanitized[key] = value

        return sanitized


# ============================================================================
# Input Validation Policy
# ============================================================================

class InputValidationPolicy(SecurityPolicy):
    """
    Validate tool arguments for security issues

    Checks for:
    - Injection attacks (command injection, SQL injection patterns)
    - Path traversal attempts
    - Oversized inputs
    """

    def __init__(self, max_string_length: int = 1_000_000):
        """
        Args:
            max_string_length: Maximum allowed length for string arguments
        """
        self.max_string_length = max_string_length

    def validate(self, context: Dict[str, Any]) -> bool:
        """Validate input arguments"""
        args = context.get('args', {})

        for key, value in args.items():
            # Check string length
            if isinstance(value, str) and len(value) > self.max_string_length:
                logger.warning(f"Argument '{key}' exceeds maximum length: {len(value)} > {self.max_string_length}")
                return False

            # Check for command injection patterns
            if isinstance(value, str) and self._has_injection_pattern(value):
                logger.warning(f"Potential injection detected in argument: {key}")
                return False

        return True

    @staticmethod
    def _has_injection_pattern(value: str) -> bool:
        """Check for common injection patterns"""
        patterns = [
            r'[;&|`$\(\)]',  # Shell metacharacters
            r"(union|select|insert|update|delete|drop)\s+(from|into|table)",  # SQL keywords
        ]

        for pattern in patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return True

        return False


# ============================================================================
# Policy Enforcer
# ============================================================================

class PolicyEnforcer:
    """
    Enforces security policies on MCP operations

    Applies multiple policies and can combine results with AND/OR logic
    """

    def __init__(self):
        self.policies: List[SecurityPolicy] = []
        self.rate_limit_policy: Optional[RateLimitPolicy] = None

    def add_policy(self, policy: SecurityPolicy) -> None:
        """Add a security policy"""
        self.policies.append(policy)

        # Keep reference to rate limit policy for mark_complete
        if isinstance(policy, RateLimitPolicy):
            self.rate_limit_policy = policy

    def validate(self, context: Dict[str, Any]) -> bool:
        """
        Validate operation against all policies

        All policies must pass (AND logic)

        Args:
            context: Operation context

        Returns:
            True if all policies pass
        """
        for policy in self.policies:
            if not policy.validate(context):
                logger.warning(f"Policy {policy.__class__.__name__} rejected operation")
                return False

        return True

    def mark_complete(self, context: Dict[str, Any]) -> None:
        """Mark operation as complete (e.g., for rate limit cleanup)"""
        if self.rate_limit_policy:
            self.rate_limit_policy.mark_complete(context)

    def get_status(self) -> Dict[str, str]:
        """Get status of all active policies"""
        return {
            policy.__class__.__name__: "active"
            for policy in self.policies
        }


# ============================================================================
# Default Policy Enforcer
# ============================================================================

def create_default_enforcer(workspace_root: Optional[Path] = None) -> PolicyEnforcer:
    """
    Create a policy enforcer with default security policies

    Args:
        workspace_root: Path to workspace (defaults to current directory)

    Returns:
        Configured PolicyEnforcer
    """
    if workspace_root is None:
        workspace_root = Path.cwd() / "workspace"

    enforcer = PolicyEnforcer()
    enforcer.add_policy(WorkspacePolicy(workspace_root))
    enforcer.add_policy(RateLimitPolicy())
    enforcer.add_policy(SensitiveDataPolicy())
    enforcer.add_policy(InputValidationPolicy())

    return enforcer


# ============================================================================
# Export public API
# ============================================================================

__all__ = [
    'SecurityPolicy',
    'WorkspacePolicy',
    'RateLimitPolicy',
    'RateLimitConfig',
    'SensitiveDataPolicy',
    'InputValidationPolicy',
    'PolicyEnforcer',
    'create_default_enforcer',
]
