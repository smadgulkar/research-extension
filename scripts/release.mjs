#!/usr/bin/env node
// One-command release: bump version, commit, tag, push. The tag triggers
// .github/workflows/release.yml, which tests, builds, and publishes to the stores.
//
// Usage: npm run release -- patch|minor|major|<x.y.z>
// Run from a clean working tree on the branch you want to release.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run release -- patch|minor|major|<x.y.z>');
  process.exit(2);
}

if (sh('git status --porcelain')) {
  console.error('Working tree is not clean. Commit or stash your changes first.');
  process.exit(1);
}

const manifestPath = 'public/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const [maj, min, pat] = manifest.version.split('.').map(Number);
const next =
  arg === 'major' ? `${maj + 1}.0.0` :
  arg === 'minor' ? `${maj}.${min + 1}.0` :
  arg === 'patch' ? `${maj}.${min}.${pat + 1}` :
  /^\d+\.\d+\.\d+$/.test(arg) ? arg : null;
if (!next) {
  console.error(`Not a valid bump or version: ${arg}`);
  process.exit(2);
}
if (sh(`git tag -l v${next}`)) {
  console.error(`Tag v${next} already exists.`);
  process.exit(1);
}

if (next !== manifest.version) {
  manifest.version = next;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  pkg.version = next;
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  execSync(`git commit -am "Release v${next}"`, { stdio: 'inherit' });
} else {
  console.log(`Manifest is already ${next}; tagging the current commit.`);
}
execSync(`git tag -a v${next} -m "v${next}"`, { stdio: 'inherit' });
execSync('git push --follow-tags', { stdio: 'inherit' });
console.log(`\nPushed v${next}. Watch the release: https://github.com/smadgulkar/research-extension/actions`);
