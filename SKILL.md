---
name: second-brain-ai
description: Read, search, relate, and assemble context from a user-specified local Markdown knowledge base using file-based scanning and smart linking. Use when the user explicitly wants a read-only Second Brain / note-vault memory layer for Markdown notes, including searching past notes, finding related notes or backlinks, building context packs, or getting smart link suggestions. Requires an explicit SECOND_BRAIN_VAULT path; do not use for broad filesystem access or note writing.
---

# Second Brain AI Skill v2.0.5

A lightweight read-only skill for inspecting a user-chosen Markdown knowledge base (Obsidian/Logseq style) with file-based search and smart link suggestions.

## Requirements

- Node.js >= 16.0.0
- A local directory containing Markdown files (.md)
- The environment variable `SECOND_BRAIN_VAULT` must be set explicitly
- Optional: Frontmatter support (YAML)
- Optional: WikiLinks support `[[Note Title]]`

## Configuration

Set the vault path via environment variable before running any script:

```bash
export SECOND_BRAIN_VAULT="/absolute/path/to/your/vault"
```

This skill no longer writes to a default home-directory vault automatically. The vault path must be explicitly provided by the user.

## Safety boundaries

- Only use this skill with a vault path the user explicitly chose.
- Do not use it for broad filesystem search outside the configured vault.
- This release is read-only. It does not create, append, delete, or rewrite user notes.
- This release uses file-based scanning only and avoids native database dependencies.


## Read-only scope

This release is intentionally read-only. It supports search, relation discovery, backlinks, context assembly, and link suggestion only. It does not create notes, append content, initialize vaults, rebuild indexes, or modify user files.
## Tools


### 1. search_notes

Search for notes by keywords in title or content using file-based scanning.

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



### 2. find_related

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

### 3. suggest_links

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

### 4. get_backlinks

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

### 5. build_context_pack

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

