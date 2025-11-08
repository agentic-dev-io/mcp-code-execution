/**
 * Skill: Filter and Transform Large Dataset
 * 
 * Process large datasets locally without sending all data through context.
 * Demonstrates context-efficient data processing.
 * 
 * Usage:
 *   import { filterLargeDataset } from './skills/typescript/filterLargeDataset.js';
 *   const filtered = await filterLargeDataset(data, { filterKey: 'status', filterValue: 'active' });
 */

interface FilterOptions<T> {
  filterKey: keyof T;
  filterValue: any;
  outputFields?: (keyof T)[];
  limit?: number;
}

/**
 * Filter large dataset and extract only needed fields
 * 
 * @param data Array of data objects
 * @param options Filter and transformation options
 * @returns Filtered and transformed data
 */
export async function filterLargeDataset<T extends Record<string, any>>(
  data: T[],
  options: FilterOptions<T>
): Promise<Partial<T>[]> {
  const { filterKey, filterValue, outputFields, limit } = options;
  
  // Filter data locally (0 context tokens)
  let filtered = data.filter(row => row[filterKey] === filterValue);
  
  // Apply limit if specified
  if (limit) {
    filtered = filtered.slice(0, limit);
  }
  
  // Extract only needed fields
  if (outputFields) {
    filtered = filtered.map(row => {
      const result: Partial<T> = {};
      for (const field of outputFields) {
        if (field in row) {
          result[field] = row[field];
        }
      }
      return result;
    });
  }
  
  console.log(`Filtered ${data.length} rows → ${filtered.length} rows`);
  return filtered;
}

