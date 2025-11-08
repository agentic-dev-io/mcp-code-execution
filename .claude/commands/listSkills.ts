/**
 * List Skills Command
 *
 * Display all registered skills with their descriptions, tags, and usage examples.
 */

import * as fs from 'fs';
import * as path from 'path';

interface SkillMetadata {
  name: string;
  displayName: string;
  description: string;
  language: 'python' | 'typescript';
  implementation: string;
  tags: string[];
  example?: string;
  author?: string;
  version?: string;
}

interface ListSkillsOptions {
  language?: 'python' | 'typescript';
  tag?: string;
  search?: string;
}

export async function listSkills(options: ListSkillsOptions = {}): Promise<void> {
  console.log('\n📚 MCP Code Execution Skills Registry\n');

  // Try to load skills from plugin.json first
  let skills: SkillMetadata[] = [];

  try {
    const pluginPath = path.join(process.cwd(), 'plugin.json');
    if (fs.existsSync(pluginPath)) {
      const pluginConfig = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
      skills = pluginConfig.skills || [];
    }
  } catch (e) {
    console.log('⚠️  Could not load skills from plugin.json');
  }

  // Filter skills based on options
  let filteredSkills = skills;

  if (options.language) {
    filteredSkills = filteredSkills.filter(s => s.language === options.language);
  }

  if (options.tag) {
    filteredSkills = filteredSkills.filter(s => s.tags.includes(options.tag!));
  }

  if (options.search) {
    const query = options.search.toLowerCase();
    filteredSkills = filteredSkills.filter(
      s =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  // Display results
  if (filteredSkills.length === 0) {
    console.log('No skills found matching your criteria.\n');
    return;
  }

  console.log(`Found ${filteredSkills.length} skill${filteredSkills.length === 1 ? '' : 's'}:\n`);

  for (const skill of filteredSkills) {
    console.log(`📌 ${skill.displayName} (${skill.language})`);
    console.log(`   Name: ${skill.name}`);
    console.log(`   ${skill.description}`);
    console.log(`   Tags: ${skill.tags.join(', ')}`);

    if (skill.example) {
      console.log(`   Example: ${skill.example}`);
    }

    if (skill.author) {
      console.log(`   Author: ${skill.author}`);
    }

    if (skill.version) {
      console.log(`   Version: ${skill.version}`);
    }

    console.log('');
  }

  // Show usage
  console.log('💡 Usage:\n');
  console.log('Python:');
  console.log('  from skills.python.example_skill import example_skill');
  console.log('  result = await example_skill(params)\n');

  console.log('TypeScript:');
  console.log('  import { exampleSkill } from "./skills/typescript/exampleSkill.js";');
  console.log('  const result = await exampleSkill(params)\n');

  // Show available tags
  const allTags = new Set<string>();
  for (const skill of skills) {
    skill.tags.forEach(t => allTags.add(t));
  }

  console.log(`Available tags: ${Array.from(allTags).sort().join(', ')}\n`);

  // Show help
  console.log('Commands:');
  console.log('  /list-skills                    - Show all skills');
  console.log('  /list-skills --language python  - Show only Python skills');
  console.log('  /list-skills --tag "data-processing" - Show skills with tag');
  console.log('  /list-skills --search "filter"  - Search skills by name/description');
  console.log('  /create-skill                   - Create a new skill\n');
}

export async function showSkillDetail(skillName: string): Promise<void> {
  try {
    const pluginPath = path.join(process.cwd(), 'plugin.json');
    if (!fs.existsSync(pluginPath)) {
      console.log('❌ plugin.json not found');
      return;
    }

    const pluginConfig = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
    const skill = pluginConfig.skills?.find(
      (s: SkillMetadata) =>
        s.name === skillName || s.displayName.toLowerCase() === skillName.toLowerCase()
    );

    if (!skill) {
      console.log(`❌ Skill not found: ${skillName}`);
      return;
    }

    console.log(`\n📌 Skill Details: ${skill.displayName}\n`);
    console.log(`Name:        ${skill.name}`);
    console.log(`Language:    ${skill.language}`);
    console.log(`Description: ${skill.description}`);
    console.log(`Tags:        ${skill.tags.join(', ')}`);

    if (skill.example) {
      console.log(`Example:     ${skill.example}`);
    }

    if (skill.author) {
      console.log(`Author:      ${skill.author}`);
    }

    if (skill.version) {
      console.log(`Version:     ${skill.version}`);
    }

    console.log(`\nImplementation: ${skill.implementation}`);

    // Try to show implementation
    const implPath = path.join(process.cwd(), skill.implementation);
    if (fs.existsSync(implPath)) {
      console.log('\n📄 Code Preview:\n');
      const content = fs.readFileSync(implPath, 'utf-8');
      const lines = content.split('\n').slice(0, 20);
      console.log(lines.join('\n'));
      if (content.split('\n').length > 20) {
        console.log('\n... (truncated)\n');
      }
    }
  } catch (e) {
    console.log(`❌ Error: ${e}`);
  }
}

// Export for use as a command
export default listSkills;
