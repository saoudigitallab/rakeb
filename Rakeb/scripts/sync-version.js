// Numéro de version unique : « const APP_VERSION » dans Rakeb/index.html.
// Ce script l'écrit dans Rakeb/package.json (et son package-lock.json) : noms des .exe, versionName de l'APK.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/const APP_VERSION = '([0-9]+\.[0-9]+\.[0-9]+)'/);
if (!m) { console.error('APP_VERSION introuvable dans Rakeb/index.html'); process.exit(1); }
const version = m[1];
const pj = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
pkg.version = version;
fs.writeFileSync(pj, JSON.stringify(pkg, null, 2) + '\n');
const lj = path.join(root, 'package-lock.json');
if (fs.existsSync(lj)) {
  const lock = JSON.parse(fs.readFileSync(lj, 'utf8'));
  lock.version = version;
  if (lock.packages && lock.packages['']) lock.packages[''].version = version;
  fs.writeFileSync(lj, JSON.stringify(lock, null, 2) + '\n');
}
const tag = process.env.GITHUB_REF_NAME || '';
if (/^v\d/.test(tag) && tag.replace(/^v/, '') !== version) {
  console.warn('Attention : le tag ' + tag + ' ne correspond pas à APP_VERSION (' + version + ').');
}
console.log('Version synchronisée : ' + version);
