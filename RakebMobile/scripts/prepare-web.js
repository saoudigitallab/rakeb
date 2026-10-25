// Prépare RakebMobile/www à partir de RakebDesktop (une seule source : index.html).
// index.html n'est pas modifié sur le disque : seule la copie reçoit le petit pont Android.
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
fs.copyFileSync(path.join(__dirname, '..', 'shim', 'android-shim.js'), path.join(www, 'android-shim.js'));
fs.readdirSync(src).filter((f) => /\.(png|jpg|svg)$/i.test(f)).forEach((f) => fs.copyFileSync(path.join(src, f), path.join(www, f)));
console.log('www prêt :', fs.readdirSync(www).join(', '));
