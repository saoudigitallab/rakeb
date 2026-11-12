// Prépare RakebMobile/www à partir de RakebDesktop (une seule source : index.html).
// index.html n'est pas modifié sur le disque : la copie est converti pour les anciennes WebView Android
// (esbuild, JavaScript ES2015 : WebView Chrome 51+, soit Android 7 d'origine et Android 5/6 avec WebView mise à jour), puis reçoit les ponts Android.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const src = path.join(__dirname, '..', '..', 'RakebDesktop');
const www = path.join(__dirname, '..', 'www');
const JS_TARGET = 'es2015';
const CSS_TARGET = 'chrome49';

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
if (html.indexOf('</head>') < 0) throw new Error('index.html : balise </head> introuvable');

// 1. JavaScript : le plus gros bloc <script> (l'application) est converti (?. ?? async/await, etc.)
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const big = scripts.reduce((a, b) => (b[1].length > a[1].length ? b : a));
const js = esbuild.transformSync(big[1], { loader: 'js', target: JS_TARGET, charset: 'utf8', legalComments: 'none' }).code;
html = html.replace(big[0], () => '<script>' + js.replace(/<\/script>/gi, '<\\/script>') + '</script>');

// 2. CSS : abaisse ce qui peut l'être (inset, couleurs, etc.)
html = html.replace(/<style>([\s\S]*?)<\/style>/g, (all, css) =>
  '<style>' + esbuild.transformSync(css, { loader: 'css', target: CSS_TARGET, legalComments: 'none' }).code + '</style>');

// 3. compléments pour anciennes WebView, puis ponts Android, avant le script de l'application
html = html.replace('</head>', '<script src="polyfills.js"></script>\n<script src="android-shim.js"></script>\n</head>');
fs.writeFileSync(path.join(www, 'index.html'), html);
fs.copyFileSync(path.join(__dirname, '..', 'shim', 'polyfills.js'), path.join(www, 'polyfills.js'));

// Adhan des notifications : fichier facultatif RakebMobile/android-res/adhan.(mp3|ogg|wav)
const resDir = path.join(__dirname, '..', 'android-res');
const adhan = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter((f) => /^adhan\.(mp3|ogg|wav)$/i.test(f))[0] : '';
fs.writeFileSync(path.join(www, 'android-shim.js'),
  fs.readFileSync(path.join(__dirname, '..', 'shim', 'android-shim.js'), 'utf8').replace('__ADHAN_FILE__', (adhan || '').toLowerCase()));
console.log(adhan ? 'Adhan natif : ' + adhan : 'Adhan natif : aucun fichier (son de notification par défaut)');

fs.readdirSync(src).filter((f) => /\.(png|jpg|svg)$/i.test(f)).forEach((f) => fs.copyFileSync(path.join(src, f), path.join(www, f)));
console.log('www prêt (JavaScript ES2015 et CSS convertis) :', fs.readdirSync(www).join(', '));
