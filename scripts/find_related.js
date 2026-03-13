#!/usr/bin/env node
/**
 * Find notes related to a topic with improved ranking
 * Version: 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { VAULT_PATH, readVaultDir, parseFrontmatter, extractWikiLinks, resolveInput, getDb, hasIndex } = require('./lib/common');

function findRelated(topic, limit = 5) {
  if (!topic || typeof topic !== 'string') {
    return { error: 'Missing required field: topic' };
  }
  if (!fs.existsSync(VAULT_PATH)) {
    return { error: `Vault not found: ${VAULT_PATH}` };
  }
  
  const files = readVaultDir(VAULT_PATH);
  const topicLower = topic.toLowerCase();
  const topicTerms = topicLower.split(/\s+/).filter(t => t.length > 0);
  const topicNotes = [];
  const related = [];
  
  // First pass: find topic notes
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);
      const title = frontmatter.title || path.basename(filePath, '.md');
      
      if (topicTerms.some(t => title.toLowerCase().includes(t))) {
        topicNotes.push({
          path: path.relative(VAULT_PATH, filePath),
          title,
          relation: 'topic-match'
        });
      }
    } catch (e) {}
  }
  
  const topicNoteTitles = new Set(topicNotes.map(n => n.title.toLowerCase()));
  
  // Second pass: find related notes with scoring
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      const title = frontmatter.title || path.basename(filePath, '.md');
      
      if (topicNoteTitles.has(title.toLowerCase())) continue;
      
      const links = extractWikiLinks(content);
      const contentLower = content.toLowerCase();
      const noteTags = new Set([...(frontmatter.tags || []), ...extractTags(body)]);
      
      let score = 0;
      let relations = [];
      
      // Links to topic notes
      for (const tn of topicNotes) {
        if (links.some(l => l.toLowerCase() === tn.title.toLowerCase())) {
          score += 40;
          relations.push('links-to');
          break;
        }
      }
      
      // Mentions topic
      if (topicTerms.some(t => contentLower.includes(t))) {
        score += 20;
        relations.push('mentions');
      }
      
      // Shared tags with topic notes
      for (const tn of topicNotes) {
        try {
          const tnContent = fs.readFileSync(path.join(VAULT_PATH, tn.path), 'utf-8');
          const { frontmatter: tnFm } = parseFrontmatter(tnContent);
          const tnTags = new Set([...(tnFm.tags || []), ...extractTags(tnContent)]);
          const shared = [...noteTags].filter(t => tnTags.has(t));
          if (shared.length > 0) {
            score += shared.length * 15;
            if (!relations.includes('shared-tags')) relations.push('shared-tags');
            break;
          }
        } catch (e) {}
      }
      
      if (score > 0) {
        related.push({
          path: path.relative(VAULT_PATH, filePath),
          title,
          relation: relations.join(', '),
          score
        });
      }
    } catch (e) {}
  }
  
  related.sort((a, b) => b.score - a.score);
  
  return {
    topic,
    topic_notes: topicNotes,
    related_notes: related.slice(0, limit),
    total: topicNotes.length + related.length
  };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ error: 'Usage: find_related.js \'{...}\'', required: ['topic'], optional: ['limit'] }, null, 2));
  process.exit(1);
}

try {
  const input = JSON.parse(args[0]);
  const topic = resolveInput(input, 'topic', 'title', 'note_title', 'query', 'q');
  const result = findRelated(topic, input.limit || 5);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.log(JSON.stringify({ error: e.message }, null, 2));
  process.exit(1);
}
