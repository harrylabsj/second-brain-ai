#!/usr/bin/env node
/**
 * Minimal regression tests for Second Brain AI repair build.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_VAULT = path.join(__dirname, 'test-vault');
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
process.env.SECOND_BRAIN_VAULT = TEST_VAULT;

function runScript(scriptName, input = {}) {
  try {
    const output = execFileSync('node', [path.join(SCRIPTS_DIR, scriptName), JSON.stringify(input)], {
      env: process.env,
      encoding: 'utf-8'
    });
    return JSON.parse(output);
  } catch (e) {
    const stdout = e.stdout ? String(e.stdout) : '';
    try {
      return JSON.parse(stdout);
    } catch (_) {
      return { error: e.message };
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanup() {
  if (fs.existsSync(TEST_VAULT)) fs.rmSync(TEST_VAULT, { recursive: true, force: true });
}

function testInit() {
  const result = runScript('init_vault.js', { allow_write: true });
  assert(result.status === 'success', 'init_vault should succeed');
  assert(fs.existsSync(TEST_VAULT), 'vault should exist');
}

function testCapture() {
  const result = runScript('capture_note.js', {
    allow_write: true,
    title: 'Test Note',
    content: 'Test content with [[Related Note]] and #test',
    type: 'idea',
    tags: ['test']
  });
  assert(result.status === 'success', 'capture_note should succeed');
  assert(result.path.includes('Test-Note'), 'path should include title slug');
}

function testCaptureSecond() {
  const result = runScript('capture_note.js', {
    allow_write: true,
    title: 'Related Note',
    content: 'Related content about testing and knowledge graphs.',
    type: 'concept',
    tags: ['test', 'knowledge']
  });
  assert(result.status === 'success', 'second capture should succeed');
}

function testAppend() {
  const result = runScript('append_note.js', {
    allow_write: true,
    title: 'Test Note',
    content: 'Appended content',
    section: 'Updates',
    appended_by: 'Pearl'
  });
  assert(result.status === 'success', 'append_note should succeed');
  assert(result.appended_by === 'Pearl', 'append_note should return appended_by');
  const notePath = path.join(TEST_VAULT, result.path);
  const body = fs.readFileSync(notePath, 'utf-8');
  assert(body.includes('Added by: Pearl'), 'note should include attribution');
}

function testSearch() {
  const result = runScript('search_notes.js', { query: 'test', limit: 5 });
  assert(result.status === 'success', 'search_notes should succeed');
  assert(Array.isArray(result.results) && result.results.length > 0, 'search should find notes');
}

function testRelated() {
  const result = runScript('find_related.js', { topic: 'Test', limit: 5 });
  assert(Array.isArray(result.topic_notes), 'find_related should return topic_notes');
}

function testBacklinks() {
  const result = runScript('get_backlinks.js', { note_title: 'Related Note' });
  assert(result.note_found === true, 'target note should be found');
  assert(result.backlink_count >= 1, 'should find at least one backlink');
}

function testContext() {
  const result = runScript('build_context_pack.js', { topic: 'test knowledge', limit: 5 });
  assert(typeof result.summary === 'string', 'context pack should return summary');
}

function testSuggest() {
  const result = runScript('suggest_links.js', { title: 'Test Note', limit: 5 });
  assert(Array.isArray(result.suggestions), 'suggest_links should return suggestions');
}

const tests = [
  testInit,
  testCapture,
  testCaptureSecond,
  testAppend,
  testSearch,
  testRelated,
  testBacklinks,
  testContext,
  testSuggest,
];

let passed = 0;
try {
  cleanup();
  for (const test of tests) {
    test();
    passed += 1;
    console.log(`✓ ${test.name}`);
  }
  console.log(`\nResults: ${passed} passed, 0 failed`);
} catch (e) {
  console.error(`✗ ${e.message}`);
  console.log(`\nResults: ${passed} passed, 1 failed`);
  process.exit(1);
} finally {
  cleanup();
}
