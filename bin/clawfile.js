#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseFile, loadLock, writeLock } from '../lib/core.js';

function usage() {
  console.log(`clawfile v0.1.0

Usage:
  clawfile sync [file] [--mode install|update] [--lock <file>] [--dry-run] [--strict] [--continue-on-error] [--refresh-lock]
  clawfile install [file] [flags...]
  clawfile update [file] [flags...]

Defaults:
  file: Clawfile
  mode: install
  lock: <file>.lock
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const cmd = args.shift();
  if (!cmd || cmd === '--help' || cmd === '-h') return { help: true };

  let file = 'Clawfile';
  let mode = cmd === 'update' ? 'update' : 'install';
  let lock;
  let dryRun = false;
  let strict = false;
  let continueOnError = false;
  let refreshLock = false;

  while (args.length) {
    const a = args.shift();
    if (!a) continue;
    if (a === '--mode') mode = args.shift() || mode;
    else if (a === '--lock') lock = args.shift();
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--strict') strict = true;
    else if (a === '--continue-on-error') continueOnError = true;
    else if (a === '--refresh-lock') refreshLock = true;
    else if (!a.startsWith('-') && file === 'Clawfile') file = a;
    else throw new Error(`Unknown arg: ${a}`);
  }

  if (cmd === 'install') mode = 'install';
  if (cmd === 'update') mode = 'update';
  if (cmd !== 'sync' && cmd !== 'install' && cmd !== 'update') throw new Error(`Unknown command: ${cmd}`);

  return { cmd, file, mode, lock: lock || `${file}.lock`, dryRun, strict, continueOnError, refreshLock };
}

function runClawhub(args, env, dryRun) {
  const cmd = `clawhub ${args.join(' ')}`;
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return { status: 0, stdout: '' };
  }
  return spawnSync('clawhub', args, { stdio: 'inherit', env: { ...process.env, ...env } });
}

function installedVersions(env) {
  const out = spawnSync('clawhub', ['list'], { encoding: 'utf8', env: { ...process.env, ...env } });
  const map = new Map();
  if (out.status !== 0 || !out.stdout) return map;
  for (const line of out.stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) map.set(parts[0], parts[1]);
  }
  return map;
}

function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.help) return usage();

  if (!existsSync(cfg.file)) throw new Error(`Missing file: ${cfg.file}`);

  const parsed = parseFile(cfg.file);
  const lock = loadLock(cfg.lock);
  const env = {};
  if (parsed.directives.registry) env.CLAWHUB_REGISTRY = parsed.directives.registry;
  if (parsed.directives.workdir) env.CLAWHUB_WORKDIR = parsed.directives.workdir;

  const installed = installedVersions(env);

  let failed = 0;
  let skipped = 0;
  let changed = 0;

  for (const s of parsed.skills) {
    const pinned = (!cfg.refreshLock && cfg.mode === 'install' && lock.get(s.slug)) ? lock.get(s.slug) : s.version;
    const targetVersion = pinned || '';
    const installedVersion = installed.get(s.slug) || '';

    if (targetVersion && installedVersion === targetVersion) {
      console.log(`Skipping ${s.slug}@${targetVersion} (already installed)`);
      skipped++;
      continue;
    }

    const args = [cfg.mode, s.slug];
    if (targetVersion) args.push('--version', targetVersion);

    const res = runClawhub(args, env, cfg.dryRun);
    if (res.status !== 0) {
      failed++;
      console.error(`Failed: ${s.slug}${targetVersion ? `@${targetVersion}` : ''}`);
      if (cfg.strict || !cfg.continueOnError) break;
    } else {
      changed++;
    }
  }

  if (!cfg.dryRun) {
    const latestInstalled = installedVersions(env);
    writeLock(cfg.lock, parsed.directives, parsed.skills, latestInstalled);
  }

  console.log(`\nDone. changed=${changed} skipped=${skipped} failed=${failed}`);
  if (!cfg.dryRun) console.log(`Lockfile: ${cfg.lock}`);

  if (failed > 0) process.exit(2);
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  usage();
  process.exit(1);
}
