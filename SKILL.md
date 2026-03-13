---
name: second-brain-ai
description: Read, capture, search, relate, and assemble context from Markdown knowledge bases with SQLite indexing and smart linking. Use when the user wants a Second Brain / external brain / knowledge-base memory layer for notes, including saving ideas, searching past notes, finding related notes or backlinks, building context packs, appending to existing notes, or getting smart link suggestions.
---

# Second Brain AI Skill v2.0.0

A lightweight skill for managing Markdown-based knowledge bases (Obsidian/Logseq style) with SQLite indexing for fast search and smart link suggestions.

## Requirements

- Node.js >= 16.0.0
- A local directory containing Markdown files (.md)
- Optional: Frontmatter support (YAML)
- Optional: WikiLinks support `[[Note Title]]`

## Configuration

Set the vault path via environment variable:

```bash
export SECOND_BRAIN_VAULT="/path/to/your/vault"
```

Or use the default: `~/Documents/SecondBrain`

## Tools

### 1. init_vault

Initialize a new Second Brain vault with standard folder structure and SQLite index.

**Usage:** `node scripts/init_vault.js`

**Output:**
```json
{
  "status": "success",
  "path": "/Users/.../Documents/SecondBrain",
  "folders": ["00-Inbox", "01-Daily", "02-Ideas", ...],
  "index": "/Users/.../.secondbrain/index.db"
}
```

---

### 2. search_notes

Search for notes by keywords in title or content. Uses SQLite index with BM25 ranking.

**Input Protocol:**
```json
{
  "query": "AI agent",    // Required (aliases: topic, title, q)
  "limit": 5,             // Optional, default: 5
  "use_index": true       // Optional, default: true
}
```

**Output:**
```json
{
  "query": "AI agent",
  "total": 3,
  "results": [
    {
      "path": "02-Ideas/2026-03-13-AI-电商.md",
      "title": "AI电商",
      "snippet": "...AI agent 可以替代平台撮合...",
      "score": 12.5,
      "rank": 1,
      "modified": "2026-03-13",
      "tags": ["ai", "电商"]
    }
  ]
}
```

---

### 3. capture_note

Create a new note with auto-generated frontmatter.

**Input Protocol:**
```json
{
  "title": "New Idea",              // Required
  "content": "Your note content",   // Optional
  "type": "idea",                   // Optional: idea|project|person|concept|reading|daily|moc
  "tags": ["ai", "thought"],        // Optional
  "links": ["Related Note"]         // Optional: WikiLinks to other notes
}
```

**Note Types & Folders:**
- `idea` → 02-Ideas/
- `project` → 03-Projects/
- `person` → 04-People/
- `concept` → 05-Concepts/
- `reading` → 06-Reading/
- `daily` → 01-Daily/
- `moc` → 07-MOCs/
- default → 00-Inbox/

**Output:**
```json
{
  "status": "success",
  "path": "02-Ideas/2026-03-13-New-Idea.md",
  "title": "New Idea",
  "type": "idea"
}
```

---

### 4. append_note

Append content to an existing note (creates if not exists).

**Input Protocol:**
```json
{
  "title": "Existing Note",         // Required: Note title to append to
  "content": "Additional content",  // Required: Content to append
  "section": "Thoughts",            // Optional: Section heading to add under
  "timestamp": true                 // Optional: Add timestamp (default: true)
}
```

**Output:**
```json
{
  "status": "success",
  "path": "02-Ideas/2026-03-13-Existing-Note.md",
  "title": "Existing Note",
  "action": "appended",
  "section_added": "Thoughts"
}
```

---

### 5. find_related

Find notes related to a given topic or note.

**Input Protocol:**
```json
{
  "topic": "OpenClaw",    // Required (aliases: title, note_title, query, q)
  "limit": 5              // Optional, default: 5
}
```

**Output:**
```json
{
  "topic": "OpenClaw",
  "topic_notes": [{"path": "...", "title": "OpenClaw", "relation": "topic-match"}],
  "related_notes": [
    {
      "path": "02-Ideas/AI-思考.md",
      "title": "AI思考",
      "relation": "mentions"
    }
  ],
  "total": 5
}
```

**Relation Types:** `topic-match`, `links-to`, `mentions`, `shared-tags`, `similar-content`

---

### 6. suggest_links

Get smart link suggestions for a note or topic based on content similarity.

**Input Protocol:**
```json
{
  "title": "My Note",       // Required: Note title to find links for
  "content": "...",         // Optional: Content to analyze (if note doesn't exist)
  "limit": 5                // Optional: Max suggestions (default: 5)
}
```

**Output:**
```json
{
  "title": "My Note",
  "suggestions": [
    {
      "note_title": "Related Note",
      "note_path": "02-Ideas/Related-Note.md",
      "reason": "shared-tags",
      "confidence": 0.85,
      "shared_tags": ["ai", "agent"]
    }
  ],
  "total": 5
}
```

---

### 7. get_backlinks

Get all notes that link to a specific note.

**Input Protocol:**
```json
{
  "note_title": "OpenClaw"    // Required (alias: title)
}
```

**Output:**
```json
{
  "note_title": "OpenClaw",
  "note_found": true,
  "note_path": "03-Projects/OpenClaw.md",
  "backlink_count": 2,
  "backlinks": [
    {
      "path": "02-Ideas/AI-思考.md",
      "title": "AI思考",
      "context": "...see [[OpenClaw]] for details...",
      "modified": "2026-03-13"
    }
  ]
}
```

---

### 8. build_context_pack

Build a context pack for a topic (for agent consumption).

**Input Protocol:**
```json
{
  "topic": "AI电商",      // Required (aliases: query, title, q)
  "limit": 10             // Optional, default: 10
}
```

**Output:**
```json
{
  "topic": "AI电商",
  "summary": "Found 5 related notes. Top 3 most relevant notes cover: agent, 电商, 撮合.",
  "related_notes": [...],
  "key_concepts": ["agent", "电商", "撮合"],
  "stats": {
    "total_notes": 42,
    "related_found": 5,
    "returned": 3
  }
}
```

---

### 9. rebuild_index

Rebuild the SQLite index from scratch (useful after external edits).

**Input Protocol:**
```json
{}
```

**Output:**
```json
{
  "status": "success",
  "indexed": 42,
  "time_ms": 125,
  "index_path": "/Users/.../.secondbrain/index.db"
}
```

---

## Directory Structure

The skill expects this vault structure (flexible):

```
vault/
├── 00-Inbox/          # New uncategorized notes
├── 01-Daily/          # Daily notes
├── 02-Ideas/          # Ideas and thoughts
├── 03-Projects/       # Project notes
├── 04-People/         # People notes
├── 05-Concepts/       # Concept definitions
├── 06-Reading/        # Reading notes
├── 07-MOCs/           # Maps of Content
└── 99-Archive/        # Archived notes
```

## Index Structure

SQLite index stored in `.secondbrain/index.db`:

- **notes** - Note metadata (path, title, type, created, updated)
- **note_content** - Full-text searchable content (FTS5)
- **links** - WikiLinks between notes
- **tags** - Tags index for fast lookup
- **backlinks** - Reverse link index

## Note Format

Standard frontmatter:

```yaml
---
id: 20260313-001
title: Note Title
type: idea
tags: [tag1, tag2]
created: 2026-03-13
updated: 2026-03-13
links:
  - Related Note
status: active
---
```

Body supports:
- Markdown formatting
- WikiLinks: `[[Note Title]]`
- Tags: `#tag` or frontmatter

## Ignore Rules

Create `.secondbrainignore` in your vault root to exclude files from search:

```
# Documentation
README.md
CHANGELOG.md

# Templates
templates/

# Archive (optional)
99-Archive/
```

Default ignored: `.git`, `.obsidian`, `.logseq`, `node_modules`, `.DS_Store`, `README.md`

## Testing

Run the test suite:

```bash
npm test                    # Run all tests
npm run test:init          # Test