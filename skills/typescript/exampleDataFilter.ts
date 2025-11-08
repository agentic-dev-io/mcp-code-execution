/**
 * Skill: Filter and transform data efficiently in execution environment
 * 
 * Demonstrates the key pattern: process large datasets HERE,
 * not through the LLM context window.
 */

export interface FilterOptions<T> {
  filterKey: keyof T;
  filterValue: any;
  outputFields?: (keyof T)[];
}

/**
 * Filter large dataset and extract only needed fields.
 */
export async function filterLargeDataset<T extends Record<string, any>>(
  data: T[],
  options: FilterOptions<T>
): Promise<Partial<T>[]> {
  const { filterKey, filterValue, outputFields } = options;
  
  let filtered = data.filter(row => row[filterKey] === filterValue);
  
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

