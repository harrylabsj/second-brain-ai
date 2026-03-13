# Second Brain AI v2.0

A lightweight OpenClaw skill for local Markdown knowledge bases with controlled write operations and attribution requirements.

## Overview

Second Brain AI v2.0 turns a local Markdown vault into an agent-usable memory layer with:
- Controlled write operations (requires explicit approval)
- Append with mandatory attribution
- Smart link suggestions
- Search, backlinks, and context packs

## Installation

```bash
clawhub install second-brain-ai
```

## Quick Start

```bash
export SECOND_BRAIN_VAULT="/path/to/your/vault"

# Initialize vault
node scripts/init_vault.js '{"allow_write":true}'

# Capture a note
node scripts/capture_note.js '{"allow_write":true,"title":"My Idea","content":"...","type":"idea"}'

# Append with attribution (REQUIRED)
node scripts/append_note.js '{"allow_write":true,"title":"My Idea","content":"Additional thoughts","appended_by":"Agent Name"}'

# Search
node scripts/search_notes.js '{"query":"idea"}'

# Suggest links
node scripts/suggest_links.js '{"title":"My Idea"}'
```

## Key Features

### Write Safety
All write operations require `allow_write: true`.

### Append Attribution
Every append must include `appended_by`:
```json
{
  "allow_write": true,
  "title": "My Note",
  "content": "New content",
  "appended_by": "Pearl"
}
```

The note will include:
```markdown
> Append Record
> Added by: Pearl
> Added at: 2026-03-13T12:00:00.000Z

New content
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `init_vault` | Create vault structure |
| `capture_note` | Create new note |
| `append_note` | Append to existing note (requires `appended_by`) |
| `search_notes` | Keyword search |
| `find_related` | Find related notes |
| `get_backlinks` | Find backlinks |
| `build_context_pack` | Build context for agents |
| `suggest_links` | Suggest related notes |
| `rebuild_index` | Refresh index (file-based) |

## Testing

```bash
npm test
```

## Limitations

- File-based scanning (no SQLite in this build)
- No semantic/vector search
- Single vault only
- Requires explicit vault path

## Version

2.0.0 - Repair build with attribution requirements
