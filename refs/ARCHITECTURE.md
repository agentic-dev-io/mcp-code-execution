# System-Architektur Übersicht

## 🎯 Wie funktioniert das System?

Das System besteht aus **zwei Hauptteilen**:

### 1. **Plugin-Kern** (`plugin/`) - Claude Code Plugin
Das ist das eigentliche Plugin, das in Claude Code läuft:

```
plugin/
├── agents/
│   └── taskExecutor.ts          ⭐ HAUPT-AGENT (führt Tasks aus)
├── commands/                     (Slash-Commands für Setup)
│   ├── setupMCP.ts
│   ├── generateWrappers.ts
│   ├── listSkills.ts
│   ├── createSkill.ts
│   └── validateConfig.ts
├── hooks/                        (Lifecycle-Hooks)
│   ├── onTaskStart.ts
│   ├── onTaskComplete.ts
│   └── onError.ts
└── config/
    └── default-config.json
```

### 2. **Runtime-Komponenten** (außerhalb des Plugins)
Diese werden zur **Laufzeit** vom Agent verwendet:

```
📁 Projekt-Root/
├── client/
│   └── typescript.ts            ⭐ MCP Client (ruft echte MCP Tools auf)
│
├── servers/typescript/           ⭐ Tool-Wrapper (werden vom Agent gefunden)
│   ├── google-drive/
│   │   ├── getDocument.ts
│   │   └── listDocuments.ts
│   ├── github/
│   │   └── getIssues.ts
│   └── salesforce/
│       ├── createLead.ts
│       └── updateRecord.ts
│
├── skills/typescript/            ⭐ Wiederverwendbare Funktionen
│   ├── saveSheetAsCsv.ts
│   ├── convertIssuesToLeads.ts
│   └── filterLargeDataset.ts
│
└── mcp_config.json               ⭐ MCP Server Konfiguration
```

## 🔄 Wie arbeitet alles zusammen?

### Ablauf eines Tasks:

```
1. USER ruft Plugin auf
   ↓
2. taskExecutor.ts (Plugin) wird gestartet
   ↓
3. Agent entdeckt Tools aus servers/typescript/
   ↓
4. Agent entdeckt Skills aus skills/typescript/
   ↓
5. Agent generiert TypeScript Code
   ↓
6. Code wird ausgeführt (verwendet client/typescript.ts)
   ↓
7. client/typescript.ts ruft echte MCP Tools auf (via mcp_config.json)
   ↓
8. Ergebnisse werden lokal verarbeitet
   ↓
9. Nur Zusammenfassung geht zurück zum Agent
```

### Beispiel:

```typescript
// USER: "Extract Google Drive documents"

// 1. Plugin startet taskExecutor
import { executeTask } from './plugin/agents/taskExecutor.js';

// 2. Agent findet Tools
//    → servers/typescript/google-drive/getDocument.ts
//    → servers/typescript/google-drive/listDocuments.ts

// 3. Agent generiert Code:
import { getDocument } from './servers/typescript/google-drive/index.js';
const doc = await getDocument({ documentId: 'abc123' });

// 4. Code wird ausgeführt
//    → getDocument.ts ruft client/typescript.ts auf
//    → client/typescript.ts verbindet zu MCP Server (aus mcp_config.json)
//    → Echte MCP Tool wird aufgerufen
//    → Daten bleiben lokal, nur Summary zurück
```

## 📊 Ist alles im Plugin oder verstreut?

### ✅ **Im Plugin** (wird von Claude Code geladen):
- `plugin/agents/taskExecutor.ts` - Haupt-Logik
- `plugin/commands/*` - Setup-Commands
- `plugin/hooks/*` - Lifecycle-Hooks

### ⚠️ **Außerhalb** (aber vom Plugin verwendet):
- `client/typescript.ts` - Wird vom generierten Code importiert
- `servers/typescript/*` - Werden vom Agent gefunden (progressive disclosure)
- `skills/typescript/*` - Werden vom Agent gefunden
- `mcp_config.json` - Wird vom Client geladen

## 🎯 Warum diese Struktur?

1. **Progressive Disclosure**: Agent findet Tools on-demand aus dem Dateisystem
2. **Code Execution**: Agent schreibt Code, der dann ausgeführt wird
3. **Separation of Concerns**: 
   - Plugin = Orchestrierung
   - Client = MCP Kommunikation
   - Servers = Tool-Wrapper
   - Skills = Wiederverwendbare Logik

## 🔧 Was passiert wo?

| Komponente | Ort | Verantwortung |
|------------|-----|---------------|
| **Task Orchestrierung** | `plugin/agents/taskExecutor.ts` | Findet Tools, generiert Code, sammelt Metriken |
| **MCP Kommunikation** | `client/typescript.ts` | Verbindet zu MCP Servern, ruft Tools auf |
| **Tool Definitions** | `servers/typescript/*` | Wrapper für MCP Tools (werden gefunden) |
| **Reusable Logic** | `skills/typescript/*` | Wiederverwendbare Funktionen |
| **Config** | `mcp_config.json` | MCP Server Einstellungen |

## 💡 Zusammenfassung

**Das Plugin ist der Orchestrator**, aber die wichtigen Komponenten sind **außerhalb**, weil:
- Sie zur Laufzeit benötigt werden (nicht nur Plugin-Start)
- Sie vom generierten Code importiert werden
- Sie progressive disclosure ermöglichen (Agent findet sie on-demand)

**Alles ist strukturiert und hat einen klaren Zweck!** 🎯

