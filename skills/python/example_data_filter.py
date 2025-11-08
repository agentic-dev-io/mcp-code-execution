"""
Skill: Filter and transform data efficiently in execution environment

Demonstrates the key pattern: process large datasets HERE,
not through the LLM context window.
"""

from typing import Any, Dict, List


async def filter_large_dataset(
    data: List[Dict[str, Any]], 
    filter_key: str,
    filter_value: Any,
    output_fields: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Filter large dataset and extract only needed fields.
    
    Args:
        data: Large dataset to filter
        filter_key: Field to filter on
        filter_value: Value to match
        output_fields: Fields to keep (None = keep all)
    
    Returns:
        Filtered and transformed dataset
    """
    filtered = [row for row in data if row.get(filter_key) == filter_value]
    
    if output_fields:
        filtered = [
            {k: row[k] for k in output_fields if k in row}
            for row in filtered
        ]
    
    print(f"Filtered {len(data)} rows → {len(filtered)} rows")
    return filtered
