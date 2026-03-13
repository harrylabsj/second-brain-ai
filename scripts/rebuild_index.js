#!/usr/bin/env node
/**
 * Rebuild the SQLite index from scratch
 * Version: 2.0.0 - NEW in v2
 */

const { rebuildIndex } = require('./lib/common');

const args = process.argv.slice(2);
const input = args.length > 0 ? JSON.parse(args[0]) : {};

const result = rebuildIndex();
console.log(JSON.stringify(result, null, 2));

if (result.status !== 'success') {
  process.exit(1);
}
