#!/usr/bin/env node
/**
 * render_erd.js - validate a Mermaid ERD and compile it to SVG.
 *
 * Usage (run from the repository root):
 *   node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
 *
 * Optional 2nd argument overrides the output path (default: docs/architecture/erd.svg).
 *
 * Exit codes / output:
 *   0  prints "SUCCESS"                 - SVG written to the output path
 *   1  prints "SYNTAX_ERROR:" + stderr  - Mermaid failed to compile (fix the .mmd and re-run)
 *   1  prints "ERROR:" + message        - bad usage (e.g. input file missing)
 *
 * Note: package.json sets "type": "module", so this file must use ESM imports.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const input = process.argv[2] ?? 'docs/architecture/schema.mmd';
const output = process.argv[3] ?? 'docs/architecture/erd.svg';

function fail(label, message) {
  console.log(`${label}: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(input)) {
  fail('ERROR', `input file not found: ${input}`);
}

// mmdc will happily render any Mermaid diagram type, so enforce that this is an ERD.
const source = fs.readFileSync(input, 'utf8');
if (!/^\s*erDiagram\b/m.test(source)) {
  fail('SYNTAX_ERROR', `${input} must contain an "erDiagram" declaration.`);
}

fs.mkdirSync(path.dirname(output), { recursive: true });

// Remove any previous render so the SVG on disk always matches the latest successful compile.
fs.rmSync(output, { force: true });
const args = ['--no-install', 'mmdc', '--quiet', '-i', input, '-o', output];

// Optional: Linux/WSL/Docker-as-root often needs Chrome's sandbox disabled (MMDC_NO_SANDBOX=1).
if (process.env.MMDC_NO_SANDBOX) {
  const cfg = path.join(os.tmpdir(), 'mmdc-puppeteer-config.json');
  fs.writeFileSync(cfg, JSON.stringify({ args: ['--no-sandbox'] }));
  args.push('-p', cfg);
}

const result = spawnSync('npx', args, {
  encoding: 'utf8',
  shell: process.platform === 'win32', // npx is npx.cmd on Windows
});

if (result.error || result.status !== 0) {
  fs.rmSync(output, { force: true });
  const trace = (result.stderr || result.stdout || result.error?.message || 'unknown error').trim();
  fail('SYNTAX_ERROR', trace);
}

console.log('SUCCESS');
process.exit(0);
