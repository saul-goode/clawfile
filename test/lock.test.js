import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLock, writeLock } from '../lib/core.js';

test('loadLock reads pinned versions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clawfile-lock-'));
  const lock = join(dir, 'Clawfile.lock');
  writeFileSync(lock, `weather@1.2.3\ntelegram@1.0.0\n`, 'utf8');

  const map = loadLock(lock);
  assert.equal(map.get('weather'), '1.2.3');
  assert.equal(map.get('telegram'), '1.0.0');
});

test('writeLock writes directives + pinned versions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clawfile-lock-write-'));
  const lock = join(dir, 'Clawfile.lock');

  writeLock(
    lock,
    { registry: 'https://clawhub.com', workdir: '/tmp/work' },
    [
      { slug: 'weather', version: '' },
      { slug: 'telegram', version: '1.0.0' }
    ],
    new Map([
      ['weather', '2.0.0'],
      ['telegram', '1.0.0']
    ])
  );

  const out = readFileSync(lock, 'utf8');
  assert.match(out, /registry https:\/\/clawhub\.com/);
  assert.match(out, /workdir \/tmp\/work/);
  assert.match(out, /weather@2\.0\.0/);
  assert.match(out, /telegram@1\.0\.0/);
});
