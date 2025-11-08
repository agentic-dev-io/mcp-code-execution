# /list-skills

List all available reusable skills in the workspace.

This command displays:
- Skill name and description
- Available in: Python / TypeScript
- Location in project
- Usage examples

**Usage:**
```
/list-skills [--filter=pattern]
```

**Examples:**
- `/list-skills` - Show all available skills
- `/list-skills --filter=data` - Show skills matching "data"
- `/list-skills --filter=extract` - Show extraction-related skills

**Current Skills:**
- **extract-action-items** - Extract ACTION:/TODO:/FOLLOW-UP: items from text (Python, TypeScript)
- **filter-large-dataset** - Efficiently process large datasets in-environment (Python)

**See Also:**
- `/create-skill` - Create new reusable skills
