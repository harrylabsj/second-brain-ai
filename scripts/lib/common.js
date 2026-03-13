/**
 * Common utilities for Second Brain AI v2.0
 * Includes SQLite index support with file-based fallback
 */

const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.SECOND_BRAIN_VAULT || path.join(process.env.HOME, 'Documents', 'SecondBrain');
const INDEX_DIR = path.join(VAULT_PATH, '.secondbrain');
const INDEX_DB_PATH = path.join(INDEX_DIR, 'index.db');

// Files/directories to ignore during scan
const DEFAULT_IGNORE_PATTERNS = [
  '.git', '.obsidian', '.logseq', '.trash', 'node_modules', '.DS_Store',
  'README.md', 'README', 'CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTING.md', 'templates'
];

let dbInstance = null;

/**
 * Get SQLite database instance (lazy load)
 */
function getDb() {
  if (dbInstance) return dbInstance;
  
  try {
    const Database = require('better-sqlite3');
    if (!fs.existsSync(INDEX_DIR)) {
      fs.mkdirSync(INDEX_DIR, { recursive: true });
    }
    dbInstance = new Database(INDEX_DB_PATH);
    initDbSchema(dbInstance);
    return dbInstance;
  } catch (e) {
    // SQLite not available, return null for fallback mode
    return null;
  }
}

/**
 * Initialize database schema
 */
function initDbSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      title TEXT,
      type TEXT,
      created TEXT,
      updated TEXT,
      status TEXT,
      content_hash TEXT
    );
    
    CREATE TABLE IF NOT EXISTS note_content (
      note_id INTEGER PRIMARY KEY,
      title TEXT,
      body TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    
    CREATE VIRTUAL TABLE IF NOT EXISTS note_content_fts USING fts5(
      title, body, content='note_content', content_rowid='note_id'
    );
    
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL,
      target_title TEXT NOT NULL,
      UNIQUE(source_path, target_title)
    );
    
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_path TEXT NOT NULL,
      tag TEXT NOT NULL,
      UNIQUE(note_path, tag)
    );
    
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
    CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_title);
    CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);
  `);
}

/**
 * Get the vault path
 */
function getVaultPath() {
  return VAULT_PATH;
}

/**
 * Get the index path
 */
function getIndexPath() {
  return INDEX_DB_PATH;
}

/**
 * Check if index is available
 */
function hasIndex() {
  return getDb() !== null && fs.existsSync(INDEX_DB_PATH);
}

/**
 * Load ignore patterns from .secondbrainignore file
 */
function loadIgnorePatterns() {
  const ignoreFile = path.join(VAULT_PATH, '.secondbrainignore');
  const patterns = [...DEFAULT_IGNORE_PATTERNS];
  
  if (fs.existsSync(ignoreFile)) {
    try {
      const content = fs.readFileSync(ignoreFile, 'utf-8');
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      patterns.push(...lines);
    } catch (e) {}
  }
  
  return patterns;
}

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filePath, ignorePatterns) {
  const basename = path.basename(filePath);
  const relativePath = path.relative(VAULT_PATH, filePath);
  
  for (const pattern of ignorePatterns) {
    if (basename === pattern) return true;
    if (relativePath.includes('/' + pattern + '/')) return true;
    if (relativePath.startsWith(pattern + '/')) return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(basename)) return true;
    }
  }
  return false;
}

/**
 * Recursively read all markdown files in vault
 */
function readVaultDir(dir, files = [], ignorePatterns = null) {
  if (!fs.existsSync(dir)) return files;
  
  const patterns = ignorePatterns || loadIgnorePatterns();
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (shouldIgnore(fullPath, patterns)) continue;
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      readVaultDir(fullPath, files, patterns);
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };
  
  const fm = match[1];
  const body = content.slice(match[0].length).trim();
  const frontmatter = {};
  
  for (const line of fm.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else {
        frontmatter[key] = value;
      }
    }
  }
  
  return { frontmatter, body };
}

/**
 * Extract WikiLinks [[Note Title]] from content
 */
function extractWikiLinks(content) {
  const links = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return [...new Set(links)];
}

/**
 * Extract hashtags from content
 */
function extractTags(content) {
  const tags = [];
  const regex = /#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.push(match[1]);
  }
  return [...new Set(tags)];
}

/**
 * Generate a unique ID for notes
 */
function generateId() {
  const now = new Date();
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Sanitize a string for use in filename
 */
function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

/**
 * Build YAML frontmatter string
 */
function buildFrontmatter(data) {
  const today = new Date().toISOString().split('T')[0];
  const lines = ['---'];
  
  lines.push(`id: ${data.id || generateId()}`);
  lines.push(`title: ${data.title}`);
  lines.push(`type: ${data.type || 'note'}`);
  
  if (data.tags && data.tags.length > 0) {
    lines.push(`tags: [${data.tags.join(', ')}]`);
  }
  
  lines.push(`created: ${today}`);
  lines.push(`updated: ${today}`);
  lines.push(`status: active`);
  
  if (data.links && data.links.length > 0) {
    lines.push('links:');
    for (const link of data.links) {
      lines.push(`  - ${link}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/**
 * Resolve input field with multiple aliases
 */
function resolveInput(input, ...keys) {
  for (const key of keys) {
    if (input[key] !== undefined) return input[key];
  }
  return undefined;
}

/**
 * Index a single note in the database
 */
function indexNote(db, filePath, content) {
  const relativePath = path.relative(VAULT_PATH, filePath);
  const { frontmatter, body } = parseFrontmatter(content);
  const title = frontmatter.title || path.basename(filePath, '.md');
  const contentHash = require('crypto').createHash('md5').update(content).digest('hex');
  
  // Insert or update note
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO notes (path, title, type, created, updated, status, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    relativePath,
    title,
    frontmatter.type || 'note',
    frontmatter.created,
    frontmatter.updated || new Date().toISOString().split('T')[0],
    frontmatter.status || 'active',
    contentHash
  );
  
  // Get note ID
  const noteId = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath).id;
  
  // Update content
  db.prepare('INSERT OR REPLACE INTO note_content (note_id, title, body) VALUES (?, ?, ?)')
    .run(noteId, title, body);
  
  // Update FTS
  db.prepare('INSERT OR REPLACE INTO note_content_fts (rowid, title, body) VALUES (?, ?, ?)')
    .run(noteId, title, body);
  
  // Update links
  db.prepare('DELETE FROM links WHERE source_path = ?').run(relativePath);
  const links = extractWikiLinks(content);
  const linkStmt = db.prepare('INSERT OR IGNORE INTO links (source_path, target_title) VALUES (?, ?)');
  for (const link of links) {
    linkStmt.run(relativePath, link);
  }
  
  // Update tags
  db.prepare('DELETE FROM tags WHERE note_path = ?').run(relativePath);
  const tags = [...(frontmatter.tags || []), ...extractTags(body)];
  const tagStmt = db.prepare('INSERT OR IGNORE INTO tags (note_path, tag) VALUES (?, ?)');
  for (const tag of tags) {
    tagStmt.run(relativePath, tag);
  }
}

/**
 * Rebuild the entire index
 */
function rebuildIndex() {
  const db = getDb();
  if (!db) return { status: 'error', error: 'SQLite not available' };
  
  const startTime = Date.now();
  
  // Clear existing data
  db.exec('DELETE FROM links; DELETE FROM tags; DELETE FROM note_content_fts; DELETE FROM note_content; DELETE FROM notes;');
  
  const files = readVaultDir(VAULT_PATH);
  let indexed = 0;
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      indexNote(db, filePath, content);
      indexed++;
    } catch (e) {}
  }
  
  return {
    status: 'success',
    indexed,
    time_ms: Date.now() - startTime,
    index_path: INDEX_DB_PATH
  };
}

/**
 * Find note by title
 */
function findNoteByTitle(title) {
  const db = getDb();
  if (db) {
    const result = db.prepare('SELECT * FROM notes WHERE LOWER(title) = LOWER(?)').get(title);
    if (result) return result;
  }
  
  // Fallback to file scan
  const files = readVaultDir(VAULT_PATH);
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);
      const fileTitle = frontmatter.title || path.basename(filePath, '.md');
      if (fileTitle.toLowerCase() === title.toLowerCase()) {
        return {
          path: path.relative(VAULT_PATH, filePath),
          title: fileTitle,
          ...frontmatter
        };
      }
    } catch (e) {}
  }
  return null;
}

module.exports = {
  getVaultPath,
  getIndexPath,
  VAULT_PATH,
  INDEX_DB_PATH,
  hasIndex,
  getDb,
  initDbSchema,
  loadIgnorePatterns,
  shouldIgnore,
  readVaultDir,
  parseFrontmatter,
  extractWikiLinks,
  extractTags,
  generateId,
  sanitizeFilename,
  buildFrontmatter,
  resolveInput,
  indexNote,
  rebuildIndex,
  findNoteByTitle
};
