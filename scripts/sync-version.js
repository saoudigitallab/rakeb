// Numéro de version unique : « const APP_VERSION » dans RakebDesktop/index.html.
// Ce script l'écrit dans les package.json du PC et d'Android (noms des fichiers .exe, versionName de l'APK).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'RakebDesktop', 'index.html'), 'utf8');
const m = html.match(/const APP_VERSION = '([0-9]+\.[0-9]+\.[0-9]+)'/);
if (!m) { console.error('APP_VERSION introuvable dans RakebDesktop/index.html'); process.exit(1); }
const version = m[1];
['RakebDesktop', 'RakebMobile'].forEach((dir) => {
  const p = path.join(root, dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
});
const tag = process.env.GITHUB_REF_NAME || '';
if (/^v\d/.test(tag) && tag.replace(/^v/, '') !== version) {
  console.warn('Attention : le tag ' + tag + ' ne correspond pas à APP_VERSION (' + version + ').');
}
console.log('Version synchronisée : ' + version);
