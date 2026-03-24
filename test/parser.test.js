import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFile } from '../lib/core.js';

test('parseFile parses directives and skills', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clawfile-test-'));
  const p = join(dir, 'Clawfile');
  writeFileSync(
    p,
    `# comment\nregistry https://clawhub.ai\nworkdir /tmp/work\n\nweather\ntelegram@1.0.0\nhttps://clawhub.ai/ivangdavila/self-improving\nivangdavila/self-improving\n`,
    'utf8'
  );

  const parsed = parseFile(p);
  assert.equal(parsed.directives.registry, 'https://clawhub.ai');
  assert.equal(parsed.directives.workdir, '/tmp/work');
  assert.deepEqual(parsed.skills, [
    { slug: 'weather', version: '' },
    { slug: 'telegram', version: '1.0.0' },
    { slug: 'self-improving', version: '' },
    { slug: 'self-improving', version: '' }
  ]);
});
