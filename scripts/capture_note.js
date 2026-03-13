#!/usr/bin/env node
/**
 * Capture a new note to the vault
 * Version: 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { VAULT_PATH, sanitizeFilename, buildFrontmatter, indexNote, getDb } = require('./lib/common');

const TYPE_FOLDERS = {
  idea: '02-Ideas', project: '03-Projects', person: '04-People',
  concept: '05-Concepts', reading: '06-Reading', daily: '01-Daily',
  moc: '07-MOCs', default: '00-Inbox'
};

function captureNote(data) {
  if (!data.title) return { error: 'Title is required' };
  if (!fs.existsSync(VAULT_PATH)) {
    try { fs.mkdirSync(VAULT_PATH, { recursive: true }); }
    catch (e) { return { error: `Cannot create vault: ${e.message}` }; }
  }
  
  const folderName = TYPE_FOLDERS[data.type] || TYPE_FOLDERS.default;
  const folderPath = path.join(VAULT_PATH, folderName);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  
  const frontmatter = buildFrontmatter(data);
  const body = data.content || '';
  const linksSection = data.links && data.links.length > 0
    ? '\n\n## Related\n\n' + data.links.map(l => `- [[${l}]]`).join('\n')
    : '';
  
  const fullContent = `${frontmatter}\n\n# ${data.title}\n\n${body}${linksSection}\n`;
  
  const datePrefix = new Date().toISOString().slice(0, 10);
  const safeTitle = sanitizeFilename(data.title);
  const filename = `${datePrefix}-${safeTitle}.md`;
  const filePath = path.join(folderPath, filename);
  
  try {
    fs.writeFileSync(filePath, fullContent, 'utf-8');
    
    // Index the new note
    const db = getDb();
    if (db) {
      try { indexNote(db, filePath, fullContent); } catch (e) {}
    }
    
    return {
      status: 'success',
      path: path.relative(VAULT_PATH, filePath),
      title: data.title,
      type: data.type || 'note'
    };
  } catch (e) {
    return { error: `Failed to write note: ${e.message}` };
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ error: 'Usage: capture_note.js \'{...}\'', required: ['title'], optional: ['content', 'type', 'tags', 'links'] }, null, 2));
  process.exit(1);
}

try {
  const input = JSON.parse(args[0]);
  const result = captureNote(input);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }, null, 2));
  process.exit(1);
}
