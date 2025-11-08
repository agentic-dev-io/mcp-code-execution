# Skills Directory

This directory contains reusable functions and scripts that agents can use to accomplish common tasks.

## Structure

Each skill is a TypeScript file that exports one or more functions. Skills can:
- Compose multiple MCP tools
- Process data locally (without sending through context)
- Save intermediate results to files
- Be imported and reused in agent-generated code

## Example Skills

- `saveSheetAsCsv.ts` - Download Google Drive sheet and save as CSV
- `convertIssuesToLeads.ts` - Convert GitHub issues to Salesforce leads
- `filterLargeDataset.ts` - Filter and transform large datasets efficiently

## Usage in Agent Code

```typescript
import { saveSheetAsCsv } from './skills/typescript/saveSheetAsCsv.js';
const csvPath = await saveSheetAsCsv('sheet-id-123');
```

## Creating New Skills

1. Create a new `.ts` file in this directory
2. Export one or more functions
3. Document the function with JSDoc comments
4. Import MCP tools from `../servers/typescript/` as needed
5. Process data locally - only log summaries to console

