// Prépare Rakeb/build/desktop : les fichiers de Rakeb.exe, à partir de la source unique Rakeb/index.html.
// Le package.json de l'exe garde le nom « rakeb-desktop » : Windows range les données des utilisateurs
// (horaires, réglages, favoris…) dans un dossier qui porte ce nom. Ne pas le changer, sinon elles semblent perdues.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'build', 'desktop');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
['index.html', 'main.js', 'preload.js', 'netcompat.js'].forEach((f) => fs.copyFileSync(path.join(root, f), path.join(out, f)));
fs.readdirSync(root).filter((f) => /\.png$/i.test(f)).forEach((f) => fs.copyFileSync(path.join(root, f), path.join(out, f)));
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({
  name: 'rakeb-desktop',
  version: version,
  description: 'Rakeb — Compagnon musulman, application de bureau (horaires de prière, Qibla, duas, Coran, recherche de mosquées en direct via OpenStreetMap/Overpass).',
  main: 'main.js',
  author: 'Rakeb',
  license: 'UNLICENSED',
  private: true
}, null, 2) + '\n');
console.log('build/desktop prêt (version ' + version + ') :', fs.readdirSync(out).join(', '));
