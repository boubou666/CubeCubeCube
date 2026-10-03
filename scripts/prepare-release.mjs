import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function prepareRelease(tag, manifest, lockfile, changelog) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error('Expected a version tag such as v0.1.0');
  }
  const version = tag.slice(1);
  if (manifest.version !== version || lockfile.version !== version || lockfile.packages?.['']?.version !== version) {
    throw new Error(`Tag ${tag} must match package.json and package-lock.json versions`);
  }
  const lines = changelog.replaceAll('\r\n', '\n').split('\n');
  const heading = `## [${version}] - `;
  const start = lines.findIndex(line => line.startsWith(heading));
  if (start < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(lines[start].slice(heading.length))) {
    throw new Error(`CHANGELOG.md needs a dated entry for ${version}`);
  }
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  const changes = lines.slice(start + 1, end).filter(line => !/^\[[^\]]+\]:/.test(line)).join('\n').trim();
  if (!/^\s*- /m.test(changes)) throw new Error(`Changelog entry ${version} is empty`);
  return {
    version, prerelease: version.includes('-'),
    notes: `${changes}\n\n[Play online](https://boubou666.github.io/CubeCubeCube/)\n\nThe web archive contains a static build. Extract it, serve the folder with a local HTTP server, and open index.html through that server.\n`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
  const output = process.argv[3] || '.local/release-notes.md';
  const [manifest, lockfile, changelog] = await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('package-lock.json', 'utf8').then(JSON.parse),
    readFile('CHANGELOG.md', 'utf8'),
  ]);
  const release = prepareRelease(tag, manifest, lockfile, changelog);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, release.notes);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `version=${release.version}\nprerelease=${release.prerelease}\n`);
  console.log(`Prepared ${tag}: ${output}`);
}
