import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRelease } from '../scripts/prepare-release.mjs';

const manifest = { version: '0.1.0' };
const lockfile = { version: '0.1.0', packages: { '': { version: '0.1.0' } } };
const changelog = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A future feature.\n\n## [0.1.0] - 2026-10-04\n\n### Added\n\n- The game.\n\n## [0.0.1] - 2026-10-03\n\n- An older feature.\n\n[0.1.0]: https://example.com\n';

test('release notes use only the matching dated changelog entry', () => {
  const result = prepareRelease('v0.1.0', manifest, lockfile, changelog);
  assert.equal(result.version, '0.1.0'); assert.equal(result.prerelease, false);
  assert.ok(result.notes.includes('- The game.'));
  assert.ok(!result.notes.includes('A future feature') && !result.notes.includes('An older feature'));
});

test('last changelog section excludes comparison links and CRLF works', () => {
  const notes = prepareRelease('v0.1.0', manifest, lockfile, '## [0.1.0] - 2026-10-04\r\n\r\n### Added\r\n\r\n- The game.\r\n\r\n[0.1.0]: https://example.com\r\n').notes;
  assert.ok(notes.includes('- The game.')); assert.ok(!notes.includes('https://example.com'));
});

test('tag and both lockfile versions must match the package version', () => {
  assert.throws(() => prepareRelease('v0.2.0', manifest, lockfile, changelog), /must match/);
  assert.throws(() => prepareRelease('v0.1.0', manifest, { ...lockfile, packages: { '': { version: '0.0.1' } } }, changelog), /must match/);
  assert.throws(() => prepareRelease('latest', manifest, lockfile, changelog), /version tag/);
});

test('undated, missing, or empty changelog releases are rejected', () => {
  for (const text of ['## [Unreleased]\n- A future feature.', '## [0.1.0]\n- The game.', '## [0.1.0] - 2026-10-04\n']) {
    assert.throws(() => prepareRelease('v0.1.0', manifest, lockfile, text));
  }
  const prerelease = prepareRelease('v0.2.0-beta.1', { version: '0.2.0-beta.1' }, { version: '0.2.0-beta.1', packages: { '': { version: '0.2.0-beta.1' } } }, '## [0.2.0-beta.1] - 2026-10-04\n\n- Preview.');
  assert.equal(prerelease.prerelease, true);
});
