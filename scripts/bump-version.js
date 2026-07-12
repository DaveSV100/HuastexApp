#!/usr/bin/env node
/**
 * bump-version.js — single source of truth for the app version + build number.
 *
 * Usage:
 *   node scripts/bump-version.js [build|patch|minor|major] [--dry-run]
 *
 * The version NAME (e.g. 2.4.0) lives in package.json "version" and is mirrored
 * to Android `versionName` and iOS `MARKETING_VERSION`.
 *
 * The BUILD NUMBER is auto-incremented to max(Android versionCode,
 * iOS CURRENT_PROJECT_VERSION) + 1 and written to BOTH platforms — so it never
 * regresses on either store (Play Store and App Store both reject an upload
 * whose build number isn't higher than the last one).
 *
 * Modes:
 *   build  (default) keep the version name, only bump the build number
 *   patch / minor / major  bump that part of the version name AND the build number
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PKG = path.join(ROOT, 'package.json');
const GRADLE = path.join(ROOT, 'android/app/build.gradle');
const PBXPROJ = path.join(ROOT, 'ios/HuastexApp.xcodeproj/project.pbxproj');

const mode = (process.argv[2] || 'build').toLowerCase();
const dryRun = process.argv.includes('--dry-run');

if (!['build', 'patch', 'minor', 'major'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: build | patch | minor | major`);
  process.exit(1);
}

const read = f => fs.readFileSync(f, 'utf8');

// ---- current values --------------------------------------------------------
const pkg = JSON.parse(read(PKG));
const gradle = read(GRADLE);
const pbx = read(PBXPROJ);

const curVersion = pkg.version || '0.0.0';
const androidCode = parseInt((gradle.match(/versionCode\s+(\d+)/) || [])[1] || '0', 10);
const iosBuild = parseInt((pbx.match(/CURRENT_PROJECT_VERSION = (\d+)/) || [])[1] || '0', 10);

// ---- compute next ----------------------------------------------------------
let [maj, min, pat] = curVersion.split('.').map(n => parseInt(n, 10) || 0);
if (mode === 'major') {
  maj += 1; min = 0; pat = 0;
} else if (mode === 'minor') {
  min += 1; pat = 0;
} else if (mode === 'patch') {
  pat += 1;
}
const newVersion = `${maj}.${min}.${pat}`;
const newBuild = Math.max(androidCode, iosBuild) + 1;

console.log(`Version bump (${mode})${dryRun ? ' [dry-run]' : ''}:`);
console.log(`  name:  ${curVersion}  ->  ${newVersion}`);
console.log(`  build: android ${androidCode} / ios ${iosBuild}  ->  ${newBuild} (both)`);

if (dryRun) {
  console.log('\nNo files changed (--dry-run).');
  process.exit(0);
}

// ---- write -----------------------------------------------------------------
pkg.version = newVersion;
fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');

fs.writeFileSync(
  GRADLE,
  gradle
    .replace(/versionCode\s+\d+/, `versionCode ${newBuild}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${newVersion}"`),
);

fs.writeFileSync(
  PBXPROJ,
  pbx
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${newBuild};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${newVersion};`),
);

console.log('\nUpdated: package.json, android/app/build.gradle, ios/.../project.pbxproj');
console.log(`Next:  git commit -am "release ${newVersion} (build ${newBuild})"`);
