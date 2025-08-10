#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...options });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function commandExists(command, cwd) {
  const r = run('bash', ['-lc', `command -v ${command} >/dev/null 2>&1`], { cwd });
  return r.status === 0;
}

function normalizeJsonDeterministically(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonDeterministically);
  }
  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const out = {};
    for (const key of sortedKeys) {
      out[key] = normalizeJsonDeterministically(value[key]);
    }
    return out;
  }
  return value;
}

function normalizeString(jsonString) {
  const parsed = JSON.parse(jsonString);
  const normalized = normalizeJsonDeterministically(parsed);
  return JSON.stringify(normalized, null, 2) + '\n';
}

function buildIdl(repoRoot) {
  const env = { ...process.env, ANCHOR_IDL_BUILD_NO_DOCS: 'TRUE' };
  const useLocalAnchor = commandExists('anchor', repoRoot);
  if (useLocalAnchor) {
    console.log('[idl-check] Running local anchor build...');
    const result = run('bash', ['-lc', 'anchor build'], { cwd: repoRoot, env });
    return result;
  }

  const useDocker = commandExists('docker', repoRoot);
  if (useDocker) {
    console.log('[idl-check] Local anchor not found. Using Docker image backpackapp/build:v0.30.1 ...');
    const result = run(
      'bash',
      [
        '-lc',
        [
          'docker run --rm',
          '-e ANCHOR_IDL_BUILD_NO_DOCS=TRUE',
          `-v "${repoRoot}":/work -w /work`,
          'backpackapp/build:v0.30.1',
          'bash -lc "anchor build"'
        ].join(' ')
      ],
      { cwd: repoRoot, env }
    );
    return result;
  }

  const err = {
    status: 127,
    stdout: '',
    stderr:
      '[idl-check] Neither local anchor nor docker is available. Install Anchor CLI or Docker to build the IDL.'
  };
  return err;
}

function main() {
  const repoRoot = resolve(__dirname, '..');
  const idlPath = join(repoRoot, 'target', 'idl', 'pump.json');

  // 1) Build IDL (prefer local anchor, fallback to docker)
  const build = buildIdl(repoRoot);
  process.stdout.write(build.stdout || '');
  process.stderr.write(build.stderr || '');
  if (build.status !== 0) {
    console.error('[idl-check] anchor build failed');
    process.exit(build.status ?? 1);
  }

  // 2) Read freshly built IDL
  let workingContent;
  try {
    workingContent = readFileSync(idlPath, 'utf8');
  } catch (e) {
    console.error(`[idl-check] Built IDL not found at ${idlPath}`);
    process.exit(2);
  }

  // 3) Read committed IDL from HEAD
  const show = run('git', ['show', `HEAD:target/idl/pump.json`], { cwd: repoRoot });
  if (show.status !== 0) {
    console.error('[idl-check] Committed IDL target/idl/pump.json not found in HEAD');
    process.exit(3);
  }
  const committedContent = show.stdout;

  // 4) Normalize deterministically (stable key order)
  const normWorking = normalizeString(workingContent);
  const normCommitted = normalizeString(committedContent);

  // 5) Compare and show diff if changed
  if (normWorking !== normCommitted) {
    const tmpDir = join(tmpdir(), 'idl-check');
    mkdirSync(tmpDir, { recursive: true });
    const a = join(tmpDir, 'committed.json');
    const b = join(tmpDir, 'working.json');
    writeFileSync(a, normCommitted, 'utf8');
    writeFileSync(b, normWorking, 'utf8');

    const diff = run('git', ['diff', '--no-index', '--unified', '--color=always', a, b], { cwd: repoRoot });
    // git diff returns exit 1 when differences exist; we still want to show the diff
    process.stdout.write(diff.stdout);
    process.stderr.write(diff.stderr);
    console.error('[idl-check] IDL drift detected. Please update the committed target/idl/pump.json.');
    process.exit(1);
  }

  console.log('[idl-check] OK: IDL matches committed version.');
}

main();