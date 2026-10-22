// Prépare le dossier desktop/ : copie l'application web, l'icône, la version, et ajoute une politique de sécurité (CSP) stricte.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const desk = path.join(root, 'desktop');

fs.rmSync(path.join(desk, 'www'), { recursive: true, force: true });
fs.cpSync(path.join(root, 'www'), path.join(desk, 'www'), { recursive: true });
fs.mkdirSync(path.join(desk, 'build'), { recursive: true });
fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(desk, 'build', 'icon.png'));

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "media-src https://*.mp3quran.net; connect-src https://api.alquran.cloud https://api.anthropic.com https://ipapi.co; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";
const idx = path.join(desk, 'www', 'index.html');
let html = fs.readFileSync(idx, 'utf8');
if (!html.includes('Content-Security-Policy')) {
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="' + csp + '">');
  fs.writeFileSync(idx, html);
}

const pkgPath = path.join(desk, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = require(path.join(root, 'package.json')).version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Bureau prêt (version ' + pkg.version + ')');
