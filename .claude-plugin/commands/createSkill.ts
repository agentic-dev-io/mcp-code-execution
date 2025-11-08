/**
 * Create Skill Command
 *
 * Creates a reusable skill from successful task solutions.
 * Skills become available to future tasks without re-explaining.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CreateSkillOptions {
  name: string;
  displayName: string;
  description: string;
  language: 'python' | 'typescript';
  code: string;
  tags?: string[];
  example?: string;
  author?: string;
}

export async function createSkill(options: CreateSkillOptions): Promise<void> {
  console.log(`\n✨ Creating new skill: ${options.displayName}\n`);

  // Validate inputs
  if (!options.name || !options.displayName || !options.description || !options.code) {
    throw new Error('Missing required fields: name, displayName, description, code');
  }

  const skillDir =
    options.language === 'python'
      ? path.join(process.cwd(), 'skills', 'python')
      : path.join(process.cwd(), 'skills', 'typescript');

  // Create skills directory if it doesn't exist
  fs.mkdirSync(skillDir, { recursive: true });

  // Determine file name based on language
  const fileName =
    options.language === 'python'
      ? `${options.name.replace(/-/g, '_')}.py`
      : `${toCamelCase(options.name)}.ts`;

  const filePath = path.join(skillDir, fileName);

  // Check if skill already exists
  if (fs.existsSync(filePath)) {
    throw new Error(`Skill already exists: ${filePath}`);
  }

  // Write skill file with proper header
  const header =
    options.language === 'python'
      ? `\"\"\"\n${options.displayName}\n\n${options.description}\n\"\"\"\n\n`
      : `/**\n * ${options.displayName}\n * \n * ${options.description}\n */\n\n`;

  fs.writeFileSync(filePath, header + options.code);
  console.log(`   ✓ Created ${fileName}`);

  // Update plugin.json with skill metadata
  const pluginPath = path.join(process.cwd(), 'plugin.json');

  if (fs.existsSync(pluginPath)) {
    const pluginConfig = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));

    if (!pluginConfig.skills) {
      pluginConfig.skills = [];
    }

    // Check for duplicate
    const exists = pluginConfig.skills.some((s: any) => s.name === options.name);
    if (exists) {
      console.log('   ⚠️  Skill already registered in plugin.json');
    } else {
      pluginConfig.skills.push({
        name: options.name,
        displayName: options.displayName,
        description: options.description,
        language: options.language,
        implementation:
          options.language === 'python'
            ? `skills/python/${options.name.replace(/-/g, '_')}.py`
            : `skills/typescript/${toCamelCase(options.name)}.ts`,
        tags: options.tags || [],
        example: options.example,
        author: options.author || 'User'
      });

      fs.writeFileSync(pluginPath, JSON.stringify(pluginConfig, null, 2));
      console.log('   ✓ Updated plugin.json');
    }
  }

  console.log(`\n✅ Skill created successfully!\n`);
  console.log(`Usage:`);

  if (options.language === 'python') {
    console.log(`  from skills.python.${options.name.replace(/-/g, '_')} import *`);
  } else {
    console.log(`  import { ${toCamelCase(options.name)} } from './skills/typescript/${toCamelCase(options.name)}.js';`);
  }

  console.log(`\nTags: ${options.tags?.join(', ') || '(none)'}`);

  if (options.example) {
    console.log(`Example: ${options.example}`);
  }

  console.log('');
}

export async function interactiveCreateSkill(): Promise<void> {
  // This would be an interactive wizard in a real CLI
  // For now, just show the template structure

  console.log(`\n✨ Create New Skill (Interactive Mode)\n`);

  const pythonTemplate = `
def my_function(param1: str, param2: int) -> dict:
    """
    Brief description of what this function does.

    Args:
        param1: Description of param1
        param2: Description of param2

    Returns:
        Dictionary with results
    """
    # Your implementation here
    return {
        'result': f'Processed {param1} with {param2}'
    }
`;

  const typescriptTemplate = `
export async function myFunction(
  param1: string,
  param2: number
): Promise<Record<string, any>> {
  // Your implementation here
  return {
    result: \`Processed \${param1} with \${param2}\`
  };
}
`;

  console.log('Python Template:');
  console.log(pythonTemplate);
  console.log('\n\nTypeScript Template:');
  console.log(typescriptTemplate);

  console.log('\n\nTo create a skill:');
  console.log('1. Write the code following the template');
  console.log('2. Call /create-skill with your code');
  console.log('3. Use the skill in future tasks');
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

// Export for use as a command
export default createSkill;
