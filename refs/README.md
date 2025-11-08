# MCP Code Execution Architecture Reference

This directory contains comprehensive documentation of Anthropic's official MCP Code Execution architecture pattern and how it differs from current implementation.

## Documents Overview

### 1. **anthropic-mcp-code-execution-reference.md** (CORE REFERENCE)
**The official architecture from Anthropic's engineering blog**

Covers:
- How Anthropic implements code execution with MCP
- The three-layer pattern (progressive disclosure, in-environment processing, summarized results)
- Tool flow architecture and context efficiency
- Key principles (progressive disclosure, in-environment processing, direct tool composition, data isolation)
- Practical implementation patterns with code examples
- Best practices and common anti-patterns

**Read this if**: You want to understand Anthropic's official recommended approach

**Key Insight**: Instead of agents calling tools through MCP protocol, agents **write code that uses tools as code-level APIs accessed through filesystem structure**. This achieves 98.7% token reduction (150k → 2k tokens).

---

### 2. **architecture-alignment-analysis.md** (DETAILED COMPARISON)
**Where current implementation stands vs. Anthropic recommended**

Covers:
- Detailed comparison table (20+ aspects)
- Section-by-section analysis of gaps
- Token usage comparisons with examples
- Gap categorization (critical, high, medium priority)
- Implementation roadmap with effort estimates
- Token efficiency calculations

**Read this if**: You want to understand what needs to change and why

**Key Finding**: Current implementation is ~40% aligned. Main gaps:
- No tool discovery pattern (tools imported upfront)
- No agent code generation (uses predefined functions)
- No explicit data filtering (results flow through context)

**Impact**: ~50-80k tokens/task vs. 2-5k tokens/task possible

---

### 3. **migration-implementation-guide.md** (STEP-BY-STEP IMPLEMENTATION)
**Practical roadmap to implement Anthropic's architecture**

Covers:
- Phase 1: Foundation (4 hours) - Tool structure, client wrapper, discovery
- Phase 2: Agent pattern (6-8 hours) - Code generation, execution, data filtering
- Phase 3: Complete implementation (4-6 hours) - Migrate servers, security, docs
- Code examples for each step
- Validation checklist
- Troubleshooting guide

**Read this if**: You're ready to implement the changes

**Estimated effort**: 16-20 hours total
**Expected result**: 97% token reduction

---

## Quick Reference

### The Core Idea (One Paragraph)

Anthropic's code execution with MCP transforms how agents interact with tools. Instead of agents calling tools through protocol (which loads all tool definitions upfront and flows intermediate results through context), agents **write TypeScript code that discovers and uses tools dynamically through a filesystem structure**. This enables:
1. **Progressive disclosure** - Tools loaded only when discovered and used
2. **Local processing** - Intermediate results stay in execution environment
3. **Direct composition** - Tools can call each other without model involvement

Result: 98%+ token reduction (150k → 2k tokens), single model round-trip instead of 5+, data privacy through architecture.

### Key Differences at a Glance

| Aspect | Traditional MCP | Code Execution MCP |
|--------|-----------------|-------------------|
| **Agent behavior** | Calls tools through protocol | Writes code that uses tools |
| **Tool discovery** | Upfront in context | Dynamic filesystem exploration |
| **Intermediate data** | Flows through model context | Processed locally in environment |
| **Model round trips** | 5+ per task | 1 per task |
| **Token usage** | 150k+ | 2-5k |
| **Tool structure** | Python imports | TypeScript files in servers/ |
| **Control flow** | Model decides each step | Agent writes loops/conditionals |

### Implementation Checklist

Quick reference for implementing Anthropic's pattern:

- [ ] **Tool exposure**: Create `servers/{name}/{tool}.ts` files (vs. Python imports)
- [ ] **Discovery**: Implement filesystem-based tool discovery
- [ ] **Agent pattern**: Generate TypeScript code from tasks (vs. calling functions)
- [ ] **Executor**: Create code execution environment with timeout/security
- [ ] **Data filtering**: Pattern for local processing before logging
- [ ] **Local composition**: Tools can call each other directly
- [ ] **Security**: Sandbox with resource limits and policy enforcement

---

## How to Use These Documents

### For Architects/Leads
1. Read **anthropic-mcp-code-execution-reference.md** (30 min) - Understand Anthropic's approach
2. Read **architecture-alignment-analysis.md** (45 min) - Understand gaps and impact
3. Review migration roadmap in **migration-implementation-guide.md** (15 min)
4. Decision: Implement in phases or partial adoption

### For Implementers
1. Start with **migration-implementation-guide.md** Phase 1
2. Reference **anthropic-mcp-code-execution-reference.md** for patterns
3. Check **architecture-alignment-analysis.md** for detailed explanations
4. Use code examples from all documents

### For Code Review
1. Check against patterns in **anthropic-mcp-code-execution-reference.md**
2. Verify no anti-patterns from "Mistakes to Avoid" section
3. Validate data filtering pattern used correctly
4. Confirm logging discipline maintained

---

## Key Principles to Remember

These five principles underlie Anthropic's entire approach:

### 1. Progressive Disclosure
Don't load information into context until needed. Use filesystem structure to enable on-demand discovery.

```typescript
// Good: Progressive discovery
const servers = fs.readdirSync('servers/');  // 0 tokens
if (servers.includes('google-drive')) {
  const tools = fs.readdirSync('servers/google-drive/');  // 0 tokens
  // Load specific tool only if needed
}

// Avoid: Preloading
import allTools from './servers/index.ts';  // All definitions in context
```

### 2. In-Environment Processing
Process large datasets where they live (execution environment), not where they're consumed (model context).

```typescript
// Good: Filter locally
const data = await fetch();
const filtered = data.filter(item => item.status === 'active');
console.log(`Filtered to ${filtered.length} items`);  // 100 tokens

// Avoid: Passing raw data
console.log(data);  // 50k tokens if large dataset
```

### 3. Direct Tool Composition
Tools can call other tools directly, without model involvement. This enables multi-step workflows at machine speed.

```typescript
// Good: Direct composition
const doc = await getDocument();
const items = extractItems(doc);
for (const item of items) {
  await createTask(item);  // No model in between
}

// Avoid: Through model
// Tool returns → Model decides → Next tool called
```

### 4. Data Isolation & Privacy
Sensitive data stays in execution environment. Only sanitized results and summaries flow to model.

```typescript
// Good: Isolation
const customers = await getCustomers();  // Stays local
const metrics = { count: customers.length, avg_value: ... };
console.log(metrics);  // Only metrics to context

// Avoid: Data exposure
console.log(customers);  // All customer data exposed
```

### 5. Explicit Logging for Context
Only consciously logged output becomes context. Implicit side effects stay local.

```typescript
// Good: Explicit
const results = await process();
console.log(`Processed ${results.length}`);  // Intentional

// Avoid: Implicit
console.log(results);  // All results to context
```

---

## Common Questions

### Q: Will this break existing functionality?
**A**: No. This restructures how agents interact with tools but keeps all MCP servers and business logic intact. It's an architectural evolution, not a rewrite.

### Q: How much effort is this?
**A**: 16-20 hours for full implementation across 3 phases. Can be done incrementally.

### Q: Do we need to rewrite all tasks?
**A**: New tasks will follow the agent code pattern automatically. Old tasks can continue to work with the current approach during migration.

### Q: What's the real-world impact?
**A**: 97% token reduction means:
- 1-hour task at 150k tokens → same task at 2-5k tokens
- Dramatic cost reduction
- Faster execution (fewer model round-trips)
- Better privacy (data isolation)

### Q: Can we do this incrementally?
**A**: Yes. Phase 1 (foundation) can stand alone. Add Phase 2 (agent pattern) when ready.

### Q: What about security?
**A**: Code execution environment has:
- Timeout enforcement
- Memory limits
- Network isolation
- Filesystem sandbox
- Security policies
- Execution logging

---

## Architecture Overview Diagram

```
Current Approach:
┌─ Model Context ─┐
├─ Tool defs    (150k tokens) ─── All tools preloaded
├─ Data         (50k tokens)  ─── Flows through context
├─ Results      (50k tokens)  ─── Again for next tool
└─ More...
Total: 150k+ tokens, 5+ model rounds

Anthropic Recommended:
┌─ Execution Environment ──┐
├─ servers/               (0 tokens in context)
│  ├─ tool1.ts            ← Load on discovery
│  ├─ tool2.ts            ← Load on discovery
│  └─ ...
├─ Data Processing         (0 tokens in context)
│  ├─ Fetch
│  ├─ Filter
│  ├─ Transform
│  └─ ...
├─ Tool Composition         (0 tokens in context)
│  ├─ Tool A calls Tool B
│  ├─ Results stay local
│  └─ ...
└─ Summary Logging          (2-5k tokens to context)
   └─ "Processed X, created Y"

Total: 2-5k tokens, 1 model round
```

---

## Timeline for Full Implementation

```
Week 1: Phase 1 - Foundation (4 hours)
├─ Tool structure
├─ Client wrapper
├─ Tool discovery
└─ First server migration

Week 2: Phase 2 - Agent Pattern (6-8 hours)
├─ Code executor
├─ Code generator
├─ Data filtering patterns
└─ Example tasks

Week 3: Phase 3 - Complete (4-6 hours)
├─ Migrate all servers
├─ Security & sandboxing
├─ Documentation
└─ Testing

Result: 97% token reduction, Anthropic-aligned architecture
```

---

## Document Status

| Document | Status | Last Updated | Complete |
|----------|--------|--------------|----------|
| Reference (Anthropic Architecture) | ✅ Complete | 2025-11-08 | Yes |
| Alignment Analysis | ✅ Complete | 2025-11-08 | Yes |
| Migration Guide | ✅ Complete | 2025-11-08 | Yes |
| Implementation Code | 🔄 Partial | 2025-11-08 | Phase 1 only |

---

## Sources

All information sourced from:
- **Anthropic Engineering Blog**: https://www.anthropic.com/engineering/code-execution-with-mcp
- **MCP Official Specification**: https://modelcontextprotocol.io/specification/2025-06-18
- **Claude Docs**: https://docs.claude.com/en/docs/agents-and-tools/mcp
- **Community Analysis**: Simon Willison's analysis and multiple interpretations

---

## Next Actions

1. **Review & Align**: Team reviews these documents and agrees on alignment goals
2. **Prioritize**: Decide on implementation phases based on impact vs. effort
3. **Plan**: Create detailed project plan with milestones
4. **Implement**: Follow migration-implementation-guide.md phases
5. **Validate**: Test token efficiency and security
6. **Train**: Team learns new patterns and best practices
7. **Monitor**: Track token usage improvements over time

---

## Contact & Questions

For questions about:
- **Anthropic's approach**: See anthropic-mcp-code-execution-reference.md
- **Current gaps**: See architecture-alignment-analysis.md
- **How to implement**: See migration-implementation-guide.md
- **Code examples**: See pattern sections in reference documents

---

**Status**: Research Complete - Implementation Ready
**Last Updated**: 2025-11-08
**Version**: 1.0
