#!/usr/bin/env node
/**
 * Initialize a new Second Brain vault with SQLite index
 * Version: 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { VAULT_PATH, INDEX_DB_PATH } = require('./lib/common');

const FOLDERS = [
  '00-Inbox', '01-Daily', '02-Ideas', '03-Projects',
  '04-People', '05-Concepts', '06-Reading', '07-MOCs', '99-Archive'
];

const README_CONTENT = `# Second Brain

Personal knowledge management vault.

## Folder Structure

- **00-Inbox** - New uncategorized notes
- **01-Daily** - Daily notes and journals
- **02-Ideas** - Ideas and thoughts
- **03-Projects** - Project notes
- **04-People** - People notes
- **05-Concepts** - Concept definitions
- **06-Reading** - Reading notes
- **07-MOCs** - Maps of Content
- **99-Archive** - Archived notes

## Quick Start

1. Capture note: \`node scripts/capture_note.js '{"title":"My Idea","type":"idea"}'\`
2. Search: \`node scripts/search_notes.js '{"query":"AI"}'\`
3. Append: \`node scripts/append_note.js '{"title":"My Idea","content":"More thoughts"}'\`
4. Suggest links: \`node scripts/suggest_links.js '{"title":"My Idea"}'\`
`;

const GITIGNORE_CONTENT = `# Second Brain Ignore Rules
README.md
CHANGELOG.md
LICENSE.md
templates/
.DS_Store
.git/
node_modules/
`;

function initVault() {
  if (fs.existsSync(VAULT_PATH)) {
    const existingFiles = fs.readdirSync(VAULT_PATH).filter(f => !f.startsWith('.'));
    if (existingFiles.length > 0) {
      console.log(JSON.stringify({ status: 'exists', path: VAULT_PATH }, null, 2));
      return;
    }
  }
  
  try {
    fs.mkdirSync(VAULT_PATH, { recursive: true });
    for (const folder of FOLDERS) {
      fs.mkdirSync(path.join(VAULT_PATH, folder), { recursive: true });
    }
    fs.writeFileSync(path.join(VAULT_PATH, 'README.md'), README_CONTENT);
    fs.writeFileSync(path.join(VAULT_PATH, '.secondbrainignore'), GITIGNORE_CONTENT);
    
    // Initialize SQLite index
    const { rebuildIndex } = require('./lib/common');
    const indexResult = rebuildIndex();
    
    console.log(JSON.stringify({
      status: 'success',
      path: VAULT_PATH,
      folders: FOLDERS,
      index: indexResult.status === 'success' ? INDEX_DB_PATH : null,
      message: 'Vault initialized successfully'
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ status: 'error', error: e.message }, null, 2));
    process.exit(1);
  }
}

initVault();
