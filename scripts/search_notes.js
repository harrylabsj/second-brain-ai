#!/usr/bin/env node
/**
 * Search notes with SQLite FTS5 ranking (fallback to file scan)
 * Version: 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { VAULT_PATH, readVaultDir, parseFrontmatter, resolveInput, getDb, hasIndex } = require('./lib/common');

function searchWithIndex(query, limit = 5) {
  const db = getDb();
  if (!db) return null;
  
  try {
    // Use FTS5 BM25 ranking
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    const searchQuery = terms.join(' ');
    
    const results = db.prepare(`
      SELECT nc.title, n.path, nc.body, bm25(note_content_fts) as score
      FROM note_content_fts
      JOIN note_content ON note_content_fts.rowid = note_content.note_id
      JOIN notes n ON n.id = note_content.note_id
      WHERE note_content_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `).all(searchQuery, limit);
    
    if (results.length === 0) return null;
    
    return results.map((r, idx) => {
      const snippet = r.body ? r.body.slice(0, 150).replace(/\n/g, ' ') + '...' : '';
      return {
        path: r.path,
        title: r.title,
        snippet,
        score: Math.abs(r.score).toFixed(2),
        rank: idx + 1
      };
    });
  } catch (e) {
    return null;
  }
}

function searchWithFileScan(query, limit = 5) {
  if (!fs.existsSync(VAULT_PATH)) return [];
  
  const files = readVaultDir(VAULT_PATH);
  const results = [];
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/).filter(t => t.length > 0);
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      const title = frontmatter.title || path.basename(filePath, '.md');
      const contentLower = content.toLowerCase();
      
      let score = 0;
      for (const term of terms) {
        if (title.toLowerCase().includes(term)) score += 10;
        const matches = contentLower.match(new RegExp(term, 'g'));
        if (matches) score += matches.length;
      }
      
      if (score > 0) {
        const firstTerm = terms.find(t => contentLower.includes(t));
        let snippet = '';
        if (firstTerm) {
          const idx = contentLower.indexOf(firstTerm);
          const start = Math.max(0, idx - 50);
          const end = Math.min(content.length, idx + firstTerm.length + 100);
          snippet = '...' + body.slice(start, end).replace(/\n/g, ' ') + '...';
        }
        
        results.push({
          path: path.relative(VAULT_PATH, filePath),
          title,
          snippet: snippet || body.slice(0, 100) + '...',
          score,
          modified: fs.statSync(filePath).mtime.toISOString().split('T')[0],
          tags: frontmatter.tags || []
        });
      }
    } catch (e) {}
  }
  
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r, idx) => ({ ...r, rank: idx + 1 }));
}

function searchNotes(query, limit = 5, useIndex = true) {
  if (!query || typeof query !== 'string') {
    return { error: 'Missing required field: query (or topic/title)' };
  }
  if (!fs.existsSync(VAULT_PATH)) {
    return { error: `Vault not found: ${VAULT_PATH}` };
  }
  
  let results = null;
  let usedIndex = false;
  
  if (useIndex && hasIndex()) {
    results = searchWithIndex(query, limit);
    usedIndex = true;
  }
  
  if (!results) {
    results = searchWithFileScan(query, limit);
    usedIndex = false;
  }
  
  return {
    query,
    total: results.length,
    results,
    used_index: usedIndex
  };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ error: 'Usage: search_notes.js \'{...}\'', required: ['query'], optional: ['limit', 'use_index'] }, null, 2));
  process.exit(1);
}

try {
  const input = JSON.parse(args[0]);
  const query = resolveInput(input, 'query', 'topic', 'title', 'q');
  const result = searchNotes(query, input.limit || 5, input.use_index !== false);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }, null, 2));
  process.exit(1);
}
