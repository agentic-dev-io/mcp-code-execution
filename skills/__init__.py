"""
Skill Registry and Discovery System

Provides centralized management, discovery, and loading of reusable skills.

Skills are self-contained, proven implementations of common patterns that can
be reused across multiple MCP tasks. The registry tracks:
- Skill metadata (name, version, description, tags)
- Available functions in each skill
- Dependencies and compatibility
- Usage examples
"""

import importlib
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ============================================================================
# Skill Metadata
# ============================================================================

@dataclass
class SkillMetadata:
    """Metadata for a skill"""
    name: str
    module: str
    language: str
    version: str = "1.0.0"
    description: str = ""
    tags: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    example: str = ""
    author: str = ""
    license: str = "MIT"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'name': self.name,
            'module': self.module,
            'language': self.language,
            'version': self.version,
            'description': self.description,
            'tags': self.tags,
            'dependencies': self.dependencies,
            'example': self.example,
            'author': self.author,
            'license': self.license
        }


# ============================================================================
# Skill Catalog
# ============================================================================

SKILL_METADATA: Dict[str, SkillMetadata] = {
    'extract_action_items': SkillMetadata(
        name='Extract Action Items',
        module='extract_action_items',
        language='python',
        version='1.0.0',
        description='Extract action items from text based on common prefixes',
        tags=['text-processing', 'document-analysis', 'nlp'],
        dependencies=[],
        example='''
from skills.python.extract_action_items import extract_action_items

text = """
Meeting Notes:
ACTION: Follow up with client about proposal
TODO: Update the spreadsheet
FOLLOW-UP: Schedule next meeting
"""

items = extract_action_items(text)
print(items)
# Output: ['ACTION: Follow up with client about proposal', 'TODO: Update the spreadsheet', 'FOLLOW-UP: Schedule next meeting']
'''
    ),

    'filter_large_dataset': SkillMetadata(
        name='Filter Large Dataset',
        module='example_data_filter',
        language='python',
        version='1.0.0',
        description='Filter large datasets efficiently in execution environment for token savings',
        tags=['data-processing', 'filtering', 'performance'],
        dependencies=[],
        example='''
from skills.python.example_data_filter import filter_large_dataset

data = [
    {'status': 'active', 'value': 1000, 'name': 'Lead A'},
    {'status': 'inactive', 'value': 500, 'name': 'Lead B'},
    {'status': 'active', 'value': 2000, 'name': 'Lead C'}
]

# Filter to active records
filtered = await filter_large_dataset(
    data,
    filter_key='status',
    filter_value='active',
    output_fields=['name', 'value']
)

print(f"Filtered to {len(filtered)} records")
'''
    ),
}


# ============================================================================
# Skill Class
# ============================================================================

class Skill:
    """Represents a reusable skill that can be loaded and called"""

    def __init__(self, name: str, metadata: SkillMetadata):
        self.name = name
        self.metadata = metadata
        self._module = None

    def load(self):
        """Load skill module dynamically"""
        if self._module is not None:
            return self._module

        module_name = f"skills.{self.metadata.language}.{self.metadata.module}"
        logger.info(f"Loading skill module: {module_name}")

        try:
            self._module = importlib.import_module(module_name)
            logger.debug(f"Successfully loaded skill: {self.name}")
            return self._module
        except ImportError as e:
            logger.error(f"Failed to load skill {self.name}: {e}")
            raise

    def get_functions(self) -> List[str]:
        """Get list of exported functions in skill"""
        module = self.load()
        return [
            name for name in dir(module)
            if not name.startswith('_') and callable(getattr(module, name))
        ]

    def get_function(self, func_name: str) -> Callable:
        """Get a specific function from the skill"""
        module = self.load()

        if not hasattr(module, func_name):
            raise AttributeError(f"Function '{func_name}' not found in skill '{self.name}'")

        func = getattr(module, func_name)
        if not callable(func):
            raise TypeError(f"'{func_name}' is not callable")

        return func

    def __repr__(self) -> str:
        return f"Skill(name='{self.name}', language='{self.metadata.language}', version='{self.metadata.version}')"


# ============================================================================
# Registry Functions
# ============================================================================

def list_skills(
    language: Optional[str] = None,
    tag: Optional[str] = None,
    limit: Optional[int] = None
) -> List[Skill]:
    """
    List available skills with optional filtering

    Args:
        language: Filter by language ('python' or 'typescript')
        tag: Filter by tag
        limit: Maximum number of results

    Returns:
        List of Skill objects

    Example:
        >>> python_skills = list_skills(language='python')
        >>> data_skills = list_skills(tag='data-processing')
    """
    skills = []

    for name, metadata in SKILL_METADATA.items():
        # Apply filters
        if language and metadata.language != language:
            continue

        if tag and tag not in metadata.tags:
            continue

        skills.append(Skill(name, metadata))

        # Apply limit
        if limit and len(skills) >= limit:
            break

    logger.info(f"Found {len(skills)} skills matching filters")
    return skills


def get_skill(name: str) -> Optional[Skill]:
    """
    Get skill by name

    Args:
        name: Skill name

    Returns:
        Skill object or None if not found

    Example:
        >>> skill = get_skill('extract_action_items')
        >>> functions = skill.get_functions()
    """
    if name not in SKILL_METADATA:
        logger.warning(f"Skill '{name}' not found")
        return None

    return Skill(name, SKILL_METADATA[name])


def search_skills(query: str) -> List[Skill]:
    """
    Search skills by name, description, or tags

    Args:
        query: Search query (case-insensitive)

    Returns:
        List of matching skills

    Example:
        >>> results = search_skills('filter')
        >>> for skill in results:
        ...     print(skill.metadata.description)
    """
    query_lower = query.lower()
    results = []

    for name, metadata in SKILL_METADATA.items():
        match = (
            query_lower in name.lower() or
            query_lower in metadata.description.lower() or
            any(query_lower in tag.lower() for tag in metadata.tags)
        )

        if match:
            results.append(Skill(name, metadata))

    logger.info(f"Search for '{query}' found {len(results)} skills")
    return results


def get_all_tags() -> List[str]:
    """Get all available tags across all skills"""
    tags = set()
    for metadata in SKILL_METADATA.values():
        tags.update(metadata.tags)

    return sorted(list(tags))


def get_skills_by_tag(tag: str) -> List[Skill]:
    """Get all skills with a specific tag"""
    return list_skills(tag=tag)


# ============================================================================
# Registry Utilities
# ============================================================================

def register_skill(name: str, metadata: SkillMetadata) -> None:
    """
    Register a new skill in the registry

    Args:
        name: Skill identifier
        metadata: SkillMetadata object

    Example:
        >>> metadata = SkillMetadata(
        ...     name='My Skill',
        ...     module='my_skill',
        ...     language='python',
        ...     description='Does something useful'
        ... )
        >>> register_skill('my_skill', metadata)
    """
    if name in SKILL_METADATA:
        logger.warning(f"Skill '{name}' already registered, overwriting")

    SKILL_METADATA[name] = metadata
    logger.info(f"Registered skill: {name}")


def unregister_skill(name: str) -> bool:
    """
    Remove a skill from the registry

    Args:
        name: Skill identifier

    Returns:
        True if skill was registered and removed, False otherwise
    """
    if name not in SKILL_METADATA:
        logger.warning(f"Skill '{name}' not found in registry")
        return False

    del SKILL_METADATA[name]
    logger.info(f"Unregistered skill: {name}")
    return True


def print_skill_info(skill: Skill) -> None:
    """Print detailed information about a skill"""
    meta = skill.metadata

    print(f"\n{meta.name} ({skill.name})")
    print(f"{'='*60}")
    print(f"Description: {meta.description}")
    print(f"Language: {meta.language} v{meta.version}")
    print(f"Tags: {', '.join(meta.tags) if meta.tags else 'None'}")
    print(f"Author: {meta.author or 'Unknown'}")
    print(f"License: {meta.license}")

    if meta.dependencies:
        print(f"Dependencies: {', '.join(meta.dependencies)}")

    try:
        functions = skill.get_functions()
        print(f"Available Functions: {', '.join(functions)}")
    except Exception as e:
        print(f"Error loading functions: {e}")

    if meta.example:
        print(f"\nExample:\n{meta.example}")


# ============================================================================
# Export public API
# ============================================================================

__all__ = [
    'Skill',
    'SkillMetadata',
    'list_skills',
    'get_skill',
    'search_skills',
    'get_all_tags',
    'get_skills_by_tag',
    'register_skill',
    'unregister_skill',
    'print_skill_info',
    'SKILL_METADATA',
]
