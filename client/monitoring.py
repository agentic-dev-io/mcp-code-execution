"""
Performance monitoring and metrics collection

Tracks:
- Tool call duration and success rates
- Token usage (input/output estimates)
- Error rates and types
- Performance trends

Provides real-time monitoring and historical analysis of MCP operations.
"""

import json
import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


# ============================================================================
# Enums
# ============================================================================

class CallStatus(Enum):
    """Status of a tool call"""
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


# ============================================================================
# Metrics Data Classes
# ============================================================================

@dataclass
class ToolCallMetrics:
    """Metrics for a single tool call"""
    server: str
    tool: str
    duration_ms: float
    tokens_input: int = 0
    tokens_output: int = 0
    status: CallStatus = CallStatus.SUCCESS
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    request_id: Optional[int] = None
    retry_count: int = 0

    @property
    def tokens_total(self) -> int:
        """Total tokens used (input + output)"""
        return self.tokens_input + self.tokens_output

    @property
    def success(self) -> bool:
        """Whether call was successful"""
        return self.status == CallStatus.SUCCESS

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['status'] = self.status.value
        data['timestamp'] = self.timestamp.isoformat()
        return data


@dataclass
class SessionMetrics:
    """Aggregated metrics for a session"""
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    total_duration_ms: float = 0.0
    total_tokens: int = 0
    errors: Dict[str, int] = field(default_factory=dict)

    @property
    def elapsed_seconds(self) -> float:
        """Elapsed time in seconds"""
        end = self.end_time or datetime.now()
        return (end - self.start_time).total_seconds()

    @property
    def success_rate(self) -> float:
        """Success rate as percentage"""
        if self.total_calls == 0:
            return 0.0
        return (self.successful_calls / self.total_calls) * 100

    @property
    def avg_duration_ms(self) -> float:
        """Average duration in milliseconds"""
        if self.total_calls == 0:
            return 0.0
        return self.total_duration_ms / self.total_calls

    @property
    def avg_tokens_per_call(self) -> float:
        """Average tokens per call"""
        if self.total_calls == 0:
            return 0.0
        return self.total_tokens / self.total_calls

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'elapsed_seconds': self.elapsed_seconds,
            'total_calls': self.total_calls,
            'successful_calls': self.successful_calls,
            'failed_calls': self.failed_calls,
            'success_rate': self.success_rate,
            'total_duration_ms': self.total_duration_ms,
            'avg_duration_ms': self.avg_duration_ms,
            'total_tokens': self.total_tokens,
            'avg_tokens_per_call': self.avg_tokens_per_call,
            'errors': self.errors,
        }


@dataclass
class ServerMetrics:
    """Metrics for a specific server"""
    server_name: str
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    total_duration_ms: float = 0.0
    total_tokens: int = 0
    tools_called: Dict[str, int] = field(default_factory=dict)

    @property
    def success_rate(self) -> float:
        """Success rate as percentage"""
        if self.total_calls == 0:
            return 0.0
        return (self.successful_calls / self.total_calls) * 100

    @property
    def avg_duration_ms(self) -> float:
        """Average duration in milliseconds"""
        if self.total_calls == 0:
            return 0.0
        return self.total_duration_ms / self.total_calls

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'server_name': self.server_name,
            'total_calls': self.total_calls,
            'successful_calls': self.successful_calls,
            'failed_calls': self.failed_calls,
            'success_rate': self.success_rate,
            'total_duration_ms': self.total_duration_ms,
            'avg_duration_ms': self.avg_duration_ms,
            'total_tokens': self.total_tokens,
            'tools_called': self.tools_called,
        }


# ============================================================================
# Metrics Collector
# ============================================================================

class MetricsCollector:
    """Collect and analyze MCP operation metrics"""

    def __init__(self, enable_logging: bool = True):
        """
        Args:
            enable_logging: Log metrics to console
        """
        self.enable_logging = enable_logging
        self.calls: List[ToolCallMetrics] = []
        self.session = SessionMetrics()
        self.server_metrics: Dict[str, ServerMetrics] = {}

    def record(self, metrics: ToolCallMetrics) -> None:
        """
        Record a tool call

        Args:
            metrics: ToolCallMetrics object
        """
        self.calls.append(metrics)

        # Update session metrics
        self.session.total_calls += 1
        if metrics.success:
            self.session.successful_calls += 1
        else:
            self.session.failed_calls += 1

        self.session.total_duration_ms += metrics.duration_ms
        self.session.total_tokens += metrics.tokens_total

        # Track error types
        if metrics.error_type:
            self.session.errors[metrics.error_type] = self.session.errors.get(metrics.error_type, 0) + 1

        # Update server metrics
        if metrics.server not in self.server_metrics:
            self.server_metrics[metrics.server] = ServerMetrics(metrics.server)

        server = self.server_metrics[metrics.server]
        server.total_calls += 1
        if metrics.success:
            server.successful_calls += 1
        else:
            server.failed_calls += 1
        server.total_duration_ms += metrics.duration_ms
        server.total_tokens += metrics.tokens_total

        if metrics.tool not in server.tools_called:
            server.tools_called[metrics.tool] = 0
        server.tools_called[metrics.tool] += 1

        if self.enable_logging:
            self._log_metric(metrics)

    def _log_metric(self, metrics: ToolCallMetrics) -> None:
        """Log metric to console"""
        status_str = "✓" if metrics.success else "✗"
        error_str = f" ({metrics.error_type})" if metrics.error_type else ""
        tokens_str = f" tokens={metrics.tokens_total}" if metrics.tokens_total > 0 else ""

        logger.info(
            f"{status_str} {metrics.server}/{metrics.tool} "
            f"({metrics.duration_ms:.1f}ms){tokens_str}{error_str}"
        )

    def get_session_summary(self) -> Dict[str, Any]:
        """Get session summary"""
        return self.session.to_dict()

    def get_server_summary(self, server: str) -> Optional[Dict[str, Any]]:
        """Get summary for specific server"""
        if server not in self.server_metrics:
            return None
        return self.server_metrics[server].to_dict()

    def get_all_servers_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary for all servers"""
        return {
            name: metrics.to_dict()
            for name, metrics in self.server_metrics.items()
        }

    def get_error_summary(self) -> Dict[str, int]:
        """Get summary of errors by type"""
        return self.session.errors.copy()

    def get_tool_summary(self, server: str, tool: str) -> Optional[Dict[str, Any]]:
        """Get summary for specific tool"""
        if server not in self.server_metrics:
            return None

        calls = [c for c in self.calls if c.server == server and c.tool == tool]
        if not calls:
            return None

        successful = sum(1 for c in calls if c.success)
        return {
            'tool': tool,
            'total_calls': len(calls),
            'successful': successful,
            'failed': len(calls) - successful,
            'success_rate': (successful / len(calls) * 100) if calls else 0,
            'avg_duration_ms': sum(c.duration_ms for c in calls) / len(calls) if calls else 0,
            'total_tokens': sum(c.tokens_total for c in calls),
        }

    def export_json(self, filepath: Path) -> None:
        """Export all metrics to JSON file"""
        self.session.end_time = datetime.now()

        data = {
            'session': self.session.to_dict(),
            'servers': self.get_all_servers_summary(),
            'errors': self.get_error_summary(),
            'calls': [c.to_dict() for c in self.calls],
        }

        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)

        logger.info(f"Metrics exported to {filepath}")

    def print_summary(self) -> None:
        """Print summary to console"""
        summary = self.get_session_summary()

        print("\n" + "="*60)
        print("MCP Operations Summary")
        print("="*60)
        print(f"Duration: {summary['elapsed_seconds']:.1f}s")
        print(f"Total Calls: {summary['total_calls']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Avg Duration: {summary['avg_duration_ms']:.1f}ms")
        print(f"Total Tokens: {summary['total_tokens']:,}")
        print(f"Avg Tokens/Call: {summary['avg_tokens_per_call']:.0f}")

        if summary['errors']:
            print(f"\nErrors:")
            for error_type, count in sorted(summary['errors'].items()):
                print(f"  {error_type}: {count}")

        print("\nBy Server:")
        for server_name, metrics in self.get_all_servers_summary().items():
            print(f"  {server_name}: {metrics['total_calls']} calls, "
                  f"{metrics['success_rate']:.1f}% success, "
                  f"{metrics['total_tokens']} tokens")

        print("="*60 + "\n")

    def clear(self) -> None:
        """Clear all collected metrics"""
        self.calls.clear()
        self.session = SessionMetrics()
        self.server_metrics.clear()


# ============================================================================
# Global Metrics Collector
# ============================================================================

_global_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """Get global metrics collector instance"""
    return _global_collector


def record_metric(metrics: ToolCallMetrics) -> None:
    """Record metric using global collector"""
    _global_collector.record(metrics)


def export_metrics(filepath: Path) -> None:
    """Export metrics using global collector"""
    _global_collector.export_metrics(filepath)


def print_metrics_summary() -> None:
    """Print summary using global collector"""
    _global_collector.print_summary()


# ============================================================================
# Context Manager for Metrics
# ============================================================================

class MetricsContext:
    """Context manager for tracking a single operation"""

    def __init__(self, server: str, tool: str, collector: Optional[MetricsCollector] = None):
        self.server = server
        self.tool = tool
        self.collector = collector or _global_collector
        self.start_time = None
        self.metrics = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000

        # Determine status
        if exc_type is not None:
            status = CallStatus.FAILED
            error_type = exc_type.__name__
            error_message = str(exc_val)
        else:
            status = CallStatus.SUCCESS
            error_type = None
            error_message = None

        self.metrics = ToolCallMetrics(
            server=self.server,
            tool=self.tool,
            duration_ms=duration_ms,
            status=status,
            error_type=error_type,
            error_message=error_message,
        )

        self.collector.record(self.metrics)

        # Don't suppress exceptions
        return False


# ============================================================================
# Decorator for automatic metrics
# ============================================================================

def track_metrics(server: str, tool: str):
    """Decorator to automatically track metrics for a function"""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            with MetricsContext(server, tool):
                return await func(*args, **kwargs)

        def sync_wrapper(*args, **kwargs):
            with MetricsContext(server, tool):
                return func(*args, **kwargs)

        # Return appropriate wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# ============================================================================
# Export public API
# ============================================================================

__all__ = [
    'CallStatus',
    'ToolCallMetrics',
    'SessionMetrics',
    'ServerMetrics',
    'MetricsCollector',
    'MetricsContext',
    'track_metrics',
    'get_metrics_collector',
    'record_metric',
    'export_metrics',
    'print_metrics_summary',
]

# Import asyncio for decorator
import asyncio
