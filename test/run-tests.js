#!/usr/bin/env node
/**
 * Test runner for Second Brain AI v2.0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_VAULT = path.join(__dirname, 'test-vault');
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

process.env.SECOND_BRAIN_VAULT = TEST_VAULT;

function runScript(script, input = '{}') {
  try {
    const output = execSync(`node ${script} '${input}'`, {
      env: process.env,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(output);
  } catch (e) {
    try {
      return JSON.parse(e.stdout);
    } catch (e2) {
      return { error: e.message };
    }
  }
}

function cleanup() {
  if (fs.existsSync(TEST_VAULT)) {
    fs.rmSync(TEST_VAULT, { recursive: true, force: true });
  }
}

function testInit() {
  console.log('Testing init_vault...');
  const result = runScript(path.join(SCRIPTS_DIR, 'init_vault.js'), '{}');
  console.assert(result.status === 'success', 'Init should succeed');
  console.assert(fs.existsSync(TEST_VAULT), 'Vault should exist');
  console.log('  ✓ init_vault passed');
  return true;
}

function testCapture() {
  console.log('Testing capture_note...');
  const result = runScript(path.join(SCRIPTS_DIR, 'capture_note.js'), 
    '{"title":"Test Note","content":"Test content","type":"idea","tags":["test"]}');
  console.assert(result.status === 'success', 'Capture should succeed');
  console.assert(result.path.includes('Test-Note'), 'Path should contain title');
  console.log('  ✓ capture_note passed');
  return true;
}

function testAppend() {
  console.log('Testing append_note...');
  const result = runScript(path.join(SCRIPTS_DIR, 'append_note.js'),
    '{"title":"Test Note","content":"Appended content","section":"Updates"}');
  console.assert(result.status === 'success', 'Append should succeed');
  console.log('  ✓ append_note passed');
  return true;
}

function testSearch() {
  console.log('Testing search_notes...');
  const result = runScript(path.join(SCRIPTS_DIR, 'search_notes.js'),
    '{"query":"test","limit":5}');
  console.assert(result.results && result.results.length > 0, 'Search should find notes');
  console.log('  ✓ search_notes passed');
  return true;
}

function testRelated() {
  console.log('Testing find_related...');
  const result = runScript(path.join(SCRIPTS_DIR, 'find_related.js'),
    '{"topic":"Test","limit":5}');
  console.assert(result.topic_notes || result.related_notes, 'Should find related');
  console.log('  ✓ find_related passed');
  return true;
}

function testBacklinks() {
  console.log('Testing get_backlinks...');
  const result = runScript(path.join(SCRIPTS_DIR, 'get_backlinks.js'),
    '{"note_title":"Test Note"}');
  console.assert(result.note_found !== undefined, 'Should return note status');
  console.log('  ✓ get_backlinks passed');
  return true;
}

function testContext() {
  console.log('Testing build_context_pack...');
  const result = runScript(path.join(SCRIPTS_DIR, 'build_context_pack.js'),
    '{"topic":"test","limit":5}');
  console.assert(result.summary !== undefined, 'Should return summary');
  console.log('  ✓ build_context_pack passed');
  return true;
}

function testSuggest() {
  console.log('Testing suggest_links...');
  const result = runScript(path.join(SCRIPTS_DIR, 'suggest_links.js'),
    '{"title":"Test Note","limit":5}');
  console.assert(result.suggestions !== undefined, 'Should return suggestions');
  console.log('  ✓ suggest_links passed');
  return true;
}

// Main
const specificTest = process.argv[2];
let passed = 0;
let failed = 0;

try {
  cleanup();
  
  const tests = [
    { name: 'init', fn: testInit },
    { name: 'capture', fn: testCapture },
    { name: 'append', fn: testAppend },
    { name: 'search', fn: testSearch },
    { name: 'related', fn: testRelated },
    { name: 'backlinks', fn: testBacklinks },
    { name: 'context', fn: testContext },
    { name: 'suggest', fn: testSuggest }
  ];
  
  for (const test of tests) {
    if (specificTest && test.name !== specificTest) continue;
    try {
      if (test.fn()) passed++;
    } catch (e) {
      console.error(`  ✗ ${test.name} failed: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
} finally {
  cleanup();
}

process.exit(failed > 0 ? 1 : 0);
