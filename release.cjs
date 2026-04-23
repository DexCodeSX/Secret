#!/usr/bin/env node
// release script — auto-bumps version everywhere, regens OG image,
// commits, tags, publishes to npm, pushes to github.
// usage:  node release.cjs [patch|minor|major]   (default: patch)
//         node release.cjs 2.6.0                 (explicit version)

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const arg = process.argv[2] || 'patch';
const ROOT = __dirname;

function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function write(f, s) { fs.writeFileSync(path.join(ROOT, f), s); }
function run(cmd, opts = {}) {
  console.log(`\x1b[2m$\x1b[0m \x1b[36m${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}
function runQuiet(cmd) { return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim(); }

let pkg = JSON.parse(read('package.json'));
let cur = pkg.version;
let newVer;

if (/^\d+\.\d+\.\d+$/.test(arg)) {
  newVer = arg;
} else if (['patch', 'minor', 'major'].includes(arg)) {
  let [maj, min, pat] = cur.split('.').map(Number);
  if (arg === 'patch') pat++;
  else if (arg === 'minor') { min++; pat = 0; }
  else if (arg === 'major') { maj++; min = 0; pat = 0; }
  newVer = `${maj}.${min}.${pat}`;
} else {
  console.error('usage: node release.cjs [patch|minor|major|X.Y.Z]');
  process.exit(1);
}

console.log(`\n\x1b[1m\x1b[32m◆ release\x1b[0m  ${cur} \x1b[2m→\x1b[0m \x1b[1m${newVer}\x1b[0m\n`);

// pre-flight
let status = runQuiet('git status --porcelain');
if (status) {
  console.error('\x1b[31m✗ working tree not clean. commit or stash first.\x1b[0m');
  console.error(status);
  process.exit(1);
}

// 1. bump package.json
pkg.version = newVer;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ package.json ${cur} → ${newVer}`);

// 2. bump bonsai.js VERSION constant
let bj = read('bonsai.js');
let bjOld = bj.match(/const VERSION = "([^"]+)"/)?.[1];
bj = bj.replace(/const VERSION = "[^"]+"/, `const VERSION = "${newVer}"`);
write('bonsai.js', bj);
console.log(`✓ bonsai.js  ${bjOld} → ${newVer}`);

// 3. bump api.js VER constant
let aj = read('api.js');
let ajOld = aj.match(/const VER = "([^"]+)"/)?.[1];
aj = aj.replace(/const VER = "[^"]+"/, `const VER = "${newVer}"`);
write('api.js', aj);
console.log(`✓ api.js     ${ajOld} → ${newVer}`);

// 4. bump trybons/VERSION (the UI auto-update marker)
try {
  let tv = read('trybons/VERSION').trim();
  let [maj, min, pat] = tv.split('.').map(Number); pat++;
  let newTv = `${maj}.${min}.${pat}`;
  write('trybons/VERSION', newTv + '\n');
  console.log(`✓ trybons UI ${tv} → ${newTv}`);
} catch {}

// 5. update OG image SVG version pill (if present)
try {
  let svg = read('trybons/og-image.svg');
  svg = svg.replace(/>v\d+\.\d+\.\d+</g, `>v${newVer}<`);
  write('trybons/og-image.svg', svg);
  console.log(`✓ og-image.svg version pill → v${newVer}`);
  // regen rasters
  console.log('  regenerating PNGs...');
  run('npx -y svgexport trybons/og-image.svg og-image.png 2400:1260');
  run('npx -y svgexport trybons/og-image.svg og-image-4k.png 4800:2520');
} catch (e) { console.log(`  ⚠ og-image regen skipped: ${e.message}`); }

// 6. commit + tag
console.log('\n📝 committing...');
run('git add -A');
run(`git commit -m "release: v${newVer}"`);
run(`git tag v${newVer}`);

// 7. npm publish (scoped public)
console.log('\n📦 publishing to npm...');
try {
  run('npm publish --access public');
} catch (e) {
  console.error('\x1b[31m✗ npm publish failed.\x1b[0m');
  console.error('rolling back tag (commit kept) — run `git tag -d v' + newVer + '` manually if needed.');
  console.error('also: make sure you ran `npm login` and have permission for @dexcodesx/bon');
  process.exit(1);
}

// 8. push to github
console.log('\n🚀 pushing to github...');
run('git push');
run('git push --tags');

console.log(`\n\x1b[1m\x1b[32m✓ released v${newVer}\x1b[0m`);
console.log(`  npm:    https://www.npmjs.com/package/@dexcodesx/bon`);
console.log(`  github: https://github.com/DexCodeSX/Secret/releases/tag/v${newVer}`);
console.log(`  install: \x1b[36mnpm i -g @dexcodesx/bon\x1b[0m`);
