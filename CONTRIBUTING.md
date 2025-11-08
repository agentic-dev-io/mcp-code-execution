# Contributing to MCP Code Execution

Thank you for your interest in contributing! This document provides guidelines for participating in the project.

## How to Contribute

### 1. Reporting Issues

Found a bug? Want to suggest a feature? Open an issue on GitHub:

1. Check if the issue already exists
2. Provide a clear description of the problem
3. Include steps to reproduce (for bugs)
4. Include your environment (OS, Python version, Node version)

### 2. Creating New Skills

Skills are reusable patterns that solve common problems. To contribute a skill:

1. **Develop and test** your solution
2. **Document the pattern** with clear examples
3. **Register the skill** using `/create-skill`
4. **Submit a pull request** with the new skill

#### Skill Template (Python)

```python
"""
Skill Name

Brief description of what this skill does.
"""

from typing import Any, Dict, List

def my_skill(param1: str, param2: int = 10) -> Dict[str, Any]:
    """
    Description of the skill.

    Args:
        param1: Description of param1
        param2: Description of param2 (default: 10)

    Returns:
        Dictionary with results

    Example:
        >>> result = my_skill("input", 5)
        >>> print(result)
    """
    # Implementation here
    return {"result": "value"}
```

#### Skill Template (TypeScript)

```typescript
/**
 * Skill Name
 *
 * Brief description of what this skill does.
 */

export interface SkillResult {
  result: string;
  [key: string]: any;
}

export async function mySkill(
  param1: string,
  param2: number = 10
): Promise<SkillResult> {
  /**
   * Description of the skill.
   *
   * @param param1 - Description of param1
   * @param param2 - Description of param2 (default: 10)
   * @returns Skill result
   *
   * @example
   * const result = await mySkill("input", 5);
   * console.log(result);
   */

  // Implementation here
  return { result: "value" };
}
```

### 3. Adding MCP Server Wrappers

New MCP server integrations are welcome:

1. **Add server to mcp_config.json**
2. **Generate wrappers** using `/generate-wrappers`
3. **Create example tasks** showing how to use the server
4. **Document usage** in the README
5. **Submit a pull request**

### 4. Improving Documentation

Documentation improvements help everyone:

- Fix typos and clarity issues
- Add missing examples
- Improve error messages
- Create tutorials

## Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- uv (Python package manager)
- bun (JavaScript runtime)

### Local Development

```bash
# Clone the repository
git clone https://github.com/anthropics/mcp-code-execution.git
cd mcp-code-execution

# Setup workspace
/setup-mcp

# Install dependencies
uv sync
bun install

# Validate configuration
/validate-config

# Run tests
pytest tests/ -v
bun test
```

## Code Style

### Python

- Use type hints for all function parameters and returns
- Follow PEP 8 style guide
- Use 4-space indentation
- Maximum line length: 100 characters
- Use docstrings (Google style)

```python
def process_data(items: List[str], max_size: int = 100) -> Dict[str, int]:
    """
    Process a list of items and return statistics.

    Args:
        items: List of items to process
        max_size: Maximum size to process (default: 100)

    Returns:
        Dictionary with processing statistics

    Raises:
        ValueError: If items is empty
    """
    if not items:
        raise ValueError("items cannot be empty")

    return {"count": len(items), "max": max_size}
```

### TypeScript

- Use strict TypeScript mode
- Define interfaces for complex objects
- Use 2-space indentation
- Maximum line length: 100 characters
- Use JSDoc comments

```typescript
/**
 * Process a list of items and return statistics.
 *
 * @param items - List of items to process
 * @param maxSize - Maximum size to process (default: 100)
 * @returns Processing statistics
 * @throws {Error} If items is empty
 */
export function processData(
  items: string[],
  maxSize: number = 100
): Record<string, number> {
  if (items.length === 0) {
    throw new Error('items cannot be empty');
  }

  return { count: items.length, max: maxSize };
}
```

## Testing

### Python Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test
pytest tests/test_file.py::test_function -v

# Run with coverage
pytest tests/ --cov=client --cov=skills
```

### TypeScript Tests

```bash
# Run tests
bun test

# Run specific test
bun test taskExecutor.test.ts
```

### Test Template

**Python:**
```python
import pytest
from client.python import call_mcp_tool

@pytest.mark.asyncio
async def test_call_tool():
    """Test basic MCP tool call."""
    result = await call_mcp_tool(
        'filesystem',
        'read_file',
        {'path': 'test.txt'}
    )
    assert result is not None
```

**TypeScript:**
```typescript
import { callMCPTool } from '../client/typescript';

test('should call MCP tool', async () => {
  const result = await callMCPTool('filesystem', 'read_file', {
    path: 'test.txt'
  });

  expect(result).toBeDefined();
});
```

## Pull Request Process

1. **Create a branch** for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them
   ```bash
   git commit -m "Add your feature description"
   ```

3. **Write tests** for new functionality
   ```bash
   pytest tests/ -v
   bun test
   ```

4. **Update documentation** if needed
   - Add to relevant README files
   - Update CHANGELOG.md with your changes
   - Include code examples

5. **Run linting and formatting**
   ```bash
   # Python
   ruff check src/
   ruff format src/

   # TypeScript
   npx prettier --write plugin/
   ```

6. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** on GitHub with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/examples if relevant

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: add skill for extracting emails from text
fix: resolve race condition in metrics collection
docs: improve installation instructions
refactor: simplify token counting logic
test: add tests for retry logic
chore: update dependencies
```

## Community Standards

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Give credit to contributors
- Follow the Code of Conduct

## Reporting Security Issues

For security vulnerabilities, **do not** open a public issue. Instead:

1. Email security@anthropic.com with details
2. Include steps to reproduce
3. Allow time for a fix before disclosure

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Check existing issues and discussions
- Read the documentation in CLAUDE.md
- Open an issue to ask questions

## Recognition

Contributors will be:
- Added to the CONTRIBUTORS file
- Mentioned in release notes
- Recognized in the marketplace plugin listing

Thank you for contributing to making MCP code execution better! 🎉
