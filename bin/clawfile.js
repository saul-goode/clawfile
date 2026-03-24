#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseFile, loadLock, writeLock } from '../lib/core.js';

function usage() {
  console.log(`clawfile v0.1.0

Usage:
  clawfile sync [file] [--mode install|update] [--lock <file>] [--dry-run] [--strict] [--continue-on-error] [--refresh-lock] [--force]
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
  let force = false;

  while (args.length) {
    const a = args.shift();
    if (!a) continue;
    if (a === '--mode') mode = args.shift() || mode;
    else if (a === '--lock') lock = args.shift();
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--strict') strict = true;
    else if (a === '--continue-on-error') continueOnError = true;
    else if (a === '--refresh-lock') refreshLock = true;
    else if (a === '--force') force = true;
    else if (!a.startsWith('-') && file === 'Clawfile') file = a;
    else throw new Error(`Unknown arg: ${a}`);
  }

  if (cmd === 'install') mode = 'install';
  if (cmd === 'update') mode = 'update';
  if (cmd !== 'sync' && cmd !== 'install' && cmd !== 'update') throw new Error(`Unknown command: ${cmd}`);

  return { cmd, file, mode, lock: lock || `${file}.lock`, dryRun, strict, continueOnError, refreshLock, force };
}

function expandHomePath(p) {
  if (!p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return `${homedir()}/${p.slice(2)}`;
  return p;
}

function normalizeWorkdir(raw) {
  const expanded = expandHomePath(raw);

  // Guard against unresolved tilde segments that would create literal "~" dirs.
  if (expanded.includes('/~/') || expanded.endsWith('/~') || expanded.startsWith('~')) {
    throw new Error(
      `Invalid workdir path: ${raw}. Tilde (~) must be at the beginning (e.g. ~/.openclaw/workspace) or use an absolute path.`
    );
  }

  return expanded;
}

function runClawhub(args, env, dryRun) {
  const cmd = `clawhub ${args.join(' ')}`;
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return { status: 0, stdout: '' };
  }
  return spawnSync('clawhub', args, { stdio: 'inherit', env: { ...process.env, ...env } });
}

function resolveSkillsDir(env) {
  const workdir = env.CLAWHUB_WORKDIR || process.cwd();
  return join(workdir, 'skills');
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

function latestVersionForSlug(slug, env, cache) {
  if (cache.has(slug)) return cache.get(slug);

  const out = spawnSync('clawhub', ['inspect', slug], { encoding: 'utf8', env: { ...process.env, ...env } });
  if (out.status !== 0) {
    cache.set(slug, '');
    return '';
  }

  const txt = `${out.stdout || ''}\n${out.stderr || ''}`;
  const m = txt.match(/^Latest:\s*([^\s]+)/m);
  const latest = m?.[1] || '';
  cache.set(slug, latest);
  return latest;
}

async function ensureClawhubInstalled() {
  const check = spawnSync('clawhub', ['--cli-version'], { stdio: 'ignore' });
  if (check.status === 0) return;

  const ci = process.env.CI === 'true' || process.env.NONINTERACTIVE === '1';
  console.error('clawfile requires the `clawhub` CLI.');

  if (ci || !process.stdin.isTTY) {
    console.error('Install it with: npm i -g clawhub');
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  try {
    const ans = (await rl.question('`clawhub` is missing. Install now with `npm i -g clawhub`? [Y/n] ')).trim().toLowerCase();
    const yes = ans === '' || ans === 'y' || ans === 'yes';
    if (!yes) {
      console.error('Okay — install manually with: npm i -g clawhub');
      process.exit(1);
    }

    const install = spawnSync('npm', ['i', '-g', 'clawhub'], { stdio: 'inherit' });
    if (install.status !== 0) {
      console.error('Automatic install failed. Please run: npm i -g clawhub');
      process.exit(1);
    }

    const verify = spawnSync('clawhub', ['--cli-version'], { stdio: 'ignore' });
    if (verify.status !== 0) {
      console.error('Install completed but `clawhub` is still not on PATH. Restart shell and retry.');
      process.exit(1);
    }

    console.log('✅ clawhub installed successfully.');
  } finally {
    rl.close();
  }
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.help) return usage();

  await ensureClawhubInstalled();

  if (!existsSync(cfg.file)) throw new Error(`Missing file: ${cfg.file}`);

  const parsed = parseFile(cfg.file);
  const lock = loadLock(cfg.lock);
  const env = {};
  if (parsed.directives.registry) env.CLAWHUB_REGISTRY = parsed.directives.registry;
  if (parsed.directives.workdir) env.CLAWHUB_WORKDIR = normalizeWorkdir(parsed.directives.workdir);

  const installed = installedVersions(env);
  const latestCache = new Map();

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

    // Smart update skip: if installed == latest and no explicit target version, skip update.
    if (cfg.mode === 'update' && !targetVersion && installedVersion) {
      const latest = latestVersionForSlug(s.slug, env, latestCache);
      if (latest && installedVersion === latest) {
        console.log(`Skipping ${s.slug}@${installedVersion} (already latest)`);
        skipped++;
        continue;
      }
    }

    const args = [cfg.mode, s.slug];
    if (targetVersion) args.push('--version', targetVersion);
    if (cfg.force) args.push('--force');

    if (cfg.mode === 'install' && !cfg.force) {
      const skillPath = join(resolveSkillsDir(env), s.slug);
      if (existsSync(skillPath)) {
        console.log(`Skipping ${s.slug} (already present at ${skillPath})`);
        skipped++;
        continue;
      }
    }

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

main().catch((err) => {
  console.error(err.message || err);
  usage();
  process.exit(1);
});
