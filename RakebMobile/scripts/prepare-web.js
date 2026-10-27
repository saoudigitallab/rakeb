// Prépare RakebMobile/www à partir de RakebDesktop (une seule source : index.html).
// index.html n'est pas modifié sur le disque : seule la copie reçoit le pont Android.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'RakebDesktop');
const www = path.join(__dirname, '..', 'www');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
if (html.indexOf('</head>') < 0) throw new Error('index.html : balise </head> introuvable');
html = html.replace('</head>', '<script src="android-shim.js"></script>\n</head>');
fs.writeFileSync(path.join(www, 'index.html'), html);

// Adhan des notifications : fichier facultatif RakebMobile/android-res/adhan.(mp3|ogg|wav)
const resDir = path.join(__dirname, '..', 'android-res');
const adhan = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter((f) => /^adhan\.(mp3|ogg|wav)$/i.test(f))[0] : '';
fs.writeFileSync(path.join(www, 'android-shim.js'),
  fs.readFileSync(path.join(__dirname, '..', 'shim', 'android-shim.js'), 'utf8').replace('__ADHAN_FILE__', (adhan || '').toLowerCase()));
console.log(adhan ? 'Adhan natif : ' + adhan : 'Adhan natif : aucun fichier (son de notification par défaut)');

fs.readdirSync(src).filter((f) => /\.(png|jpg|svg)$/i.test(f)).forEach((f) => fs.copyFileSync(path.join(src, f), path.join(www, f)));
console.log('www prêt :', fs.readdirSync(www).join(', '));
