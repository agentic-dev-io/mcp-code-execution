# Wie verwendet man das Plugin?

## 🎯 Der Sinn: Warum beide Sprachen?

### Problem ohne Code Execution:
```
❌ Traditional Approach:
1. Alle Tool-Definitionen im Context (100k+ Tokens)
2. Große Daten durch Context (50k Tokens)
3. Wiederholte Daten in verketteten Calls (100k+ Tokens)
→ Langsam, teuer, Context-Limits erreicht
```

### Lösung mit Code Execution:
```
✅ Code Execution Approach:
1. Tool-Definitionen on-demand vom Dateisystem (500 Tokens)
2. Datenverarbeitung im Execution Environment (0 Tokens)
3. Nur Zusammenfassung zurück (1k Tokens)
→ 95-99% Token-Reduktion, schneller, skalierbar
```

## 📖 Wie verwendet man es?

### In Claude Code (als Plugin):

**1. Plugin installieren:**
- Plugin wird in Claude Code geladen
- Automatisch verfügbar über Commands und Agents

**2. Task ausführen:**

Du sagst zu Claude:
```
"Extract all action items from my Google Drive meeting notes 
and create Salesforce tasks for them"
```

**3. Was passiert automatisch:**

```
1. Claude ruft taskExecutor Agent auf
   ↓
2. Agent findet Tools: plugin/servers/typescript/google-drive/
   ↓
3. Agent findet Skills: plugin/skills/typescript/convertIssuesToLeads.ts
   ↓
4. Agent generiert TypeScript Code:
   
   import { getDocument } from './plugin/servers/typescript/google-drive/index.js';
   import { convertIssuesToLeads } from './plugin/skills/typescript/convertIssuesToLeads.js';
   
   const doc = await getDocument({ documentId: 'abc123' });
   const actions = extractActions(doc.content);
   await convertIssuesToLeads('owner/repo', { issues: actions });
   
   ↓
5. Code wird ausgeführt (Daten bleiben lokal!)
   ↓
6. Nur Zusammenfassung zurück: "Created 5 Salesforce leads"
```

## 🔧 Praktische Verwendung

### Option 1: Direkt in Code (TypeScript)

```typescript
import { executeTask } from './plugin/agents/taskExecutor.js';

// TypeScript Task
const result = await executeTask({
  description: 'Fetch GitHub issues and create Salesforce leads',
  servers: ['github', 'salesforce'],
  language: 'typescript',  // Optional, default
  options: {
    collectMetrics: true
  }
});

console.log(result.output);  // "Created 5 leads from 10 issues"
```

### Option 2: Direkt in Code (Python)

```python
# In Python-Code (wenn Python Runtime verfügbar)
from plugin.agents.taskExecutor import executeTask

result = await executeTask({
    'description': 'Process Google Drive documents',
    'servers': ['google-drive'],
    'language': 'python',  # Python-Code generieren
    'options': {
        'collectMetrics': True
    }
})

print(result['output'])
```

### Option 3: Über Claude Code Plugin Commands

```
/setup-mcp                    # Workspace initialisieren
/generate-wrappers            # Server-Wrapper generieren
/list-skills                  # Verfügbare Skills anzeigen
/create-skill --name extract-emails --language python
```

## 🤔 Wann welche Sprache?

### TypeScript wählen wenn:
- ✅ Du bereits TypeScript/JavaScript verwendest
- ✅ Du mit bun/node arbeitest
- ✅ Du moderne ES6+ Features brauchst
- ✅ Du Web-APIs integrierst

### Python wählen wenn:
- ✅ Du bereits Python-Skills/Scripts hast
- ✅ Du Data Science/ML machst (pandas, numpy)
- ✅ Du mit Python-Libraries arbeitest
- ✅ Dein Team Python bevorzugt

## 💡 Konkrete Beispiele

### Beispiel 1: TypeScript Task

```typescript
// Du sagst zu Claude:
"Get all open GitHub issues from my repo and create Salesforce leads"

// Claude generiert automatisch:
import { getIssues } from './plugin/servers/typescript/github/index.js';
import { createLead } from './plugin/servers/typescript/salesforce/index.js';

const issues = await getIssues({ repo: 'owner/repo', state: 'open' });
for (const issue of issues.issues) {
  await createLead({
    firstName: 'GitHub',
    lastName: `Issue #${issue.number}`,
    email: `issue-${issue.number}@github.com`,
    company: 'owner/repo'
  });
}
console.log(`Created ${issues.issues.length} leads`);
```

### Beispiel 2: Python Task

```python
# Du sagst zu Claude:
"Process my Google Drive spreadsheet and filter for high-value customers"

# Claude generiert automatisch:
from plugin.servers.python.google_drive import get_sheet
from plugin.skills.python.filter_large_dataset import filter_large_dataset

sheet = await get_sheet(sheet_id='abc123')
high_value = await filter_large_dataset(
    sheet.rows,
    filter_key='value',
    filter_value=50000,
    limit=100
)
print(f"Found {len(high_value)} high-value customers")
```

## 🎯 Der Vorteil

**Ohne Plugin (Traditional):**
- Claude muss alle Tool-Definitionen kennen (100k+ Tokens)
- Jedes Tool-Result geht durch Context
- Mehrere Round-Trips nötig
- Teuer und langsam

**Mit Plugin (Code Execution):**
- Claude findet Tools on-demand (500 Tokens)
- Datenverarbeitung lokal (0 Tokens)
- Ein Round-Trip
- 95-99% günstiger und schneller

## 📚 Zusammenfassung

**Das Plugin macht Claude effizienter:**
1. ✅ Findet Tools automatisch (progressive disclosure)
2. ✅ Generiert Code in Python oder TypeScript
3. ✅ Verarbeitet Daten lokal (nicht im Context)
4. ✅ Reduziert Token-Verbrauch um 95-99%
5. ✅ Unterstützt beide Sprachen für Flexibilität

**Du verwendest es einfach:**
- Sage Claude was du willst
- Claude generiert automatisch Code
- Code wird ausgeführt
- Nur Zusammenfassung kommt zurück

**Das ist der Sinn!** 🚀

