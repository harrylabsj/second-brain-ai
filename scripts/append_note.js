#!/usr/bin/env node
/**
 * Append content to an existing note (creates if not exists)
 * Version: 2.0.0 - NEW in v2
 */

const fs = require('fs');
const path = require('path');
const { VAULT_PATH, readVaultDir, parseFrontmatter, indexNote, getDb } = require('./lib/common');

function findNoteFile(title) {
  if (!fs.existsSync(VAULT_PATH)) return null;
  const files = readVaultDir(VAULT_PATH);
  const titleLower = title.toLowerCase();
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);
      const fileTitle = frontmatter.title || path.basename(filePath, '.md');
      if (fileTitle.toLowerCase() === titleLower) {
        return filePath;
      }
    } catch (e) {}
  }
  return null;
}

function appendNote(data) {
  if (!data.title) return { error: 'Title is required' };
  if (!data.content) return { error: 'Content is required' };
  
  if (!fs.existsSync(VAULT_PATH)) {
    try { fs.mkdirSync(VAULT_PATH, { recursive: true }); }
    catch (e) { return { error: `Cannot create vault: ${e.message}` }; }
  }
  
  let filePath = findNoteFile(data.title);
  let isNew = false;
  
  if (!filePath) {
    // Create new note in Inbox
    const datePrefix = new Date().toISOString().slice(0, 10);
    const safeTitle = data.title.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').slice(0, 50);
    const filename = `${datePrefix}-${safeTitle}.md`;
    filePath = path.join(VAULT_PATH, '00-Inbox', filename);
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const frontmatter = `---
id: ${today.replace(/-/g, '')}
title: ${data.title}
type: note
created: ${today}
updated: ${today}
status: active
---

# ${data.title}
`;
    fs.writeFileSync(filePath, frontmatter, 'utf-8');
    isNew = true;
  }
  
  // Read existing content
  let content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);
  
  // Build append content
  const timestamp = data.timestamp !== false;
  const section = data.section || null;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  let appendContent = '';
  if (section) {
    appendContent = `\n\n## ${section}${timestamp ? ` (${now})` : ''}\n\n${data.content}\n`;
  } else {
    appendContent = `\n\n---\n\n${timestamp ? `*Added: ${now}*\n\n` : ''}${data.content}\n`;
  }
  
  // Find end of frontmatter and append
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  if (fmMatch) {
    content = content.slice(0, fmMatch[0].length) + body + appendContent;
  } else {
    content = content + appendContent;
  }
  
  // Update frontmatter updated date
  const today = new Date().toISOString().split('T')[0];
  content = content.replace(/^(---\n[\s\S]*?)updated: [^\n]+/m, `$1updated: ${today}`);
  if (!content.includes('updated:')) {
    content = content.replace(/^---\n/, `---\nupdated: ${today}\n`);
  }
  
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    
    // Re-index
    const db = getDb();
    if (db) {
      try { indexNote(db, filePath, content); } catch (e) {}
    }
    
    return {
      status: 'success',
      path: path.relative(VAULT_PATH, filePath),
      title: data.title,
      action: isNew ? 'created' : 'appended',
      section_added: section || null
    };
  } catch (e) {
    return { error: `Failed to update note: ${e.message}` };
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ error: 'Usage: append_note.js \'{...}\'', required: ['title', 'content'], optional: ['section', 'timestamp'] }, null, 2));
  process.exit(1);
}

try {
  const input = JSON.parse(args[0]);
  const result = appendNote(input);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }, null, 2));
  process.exit(1);
}
