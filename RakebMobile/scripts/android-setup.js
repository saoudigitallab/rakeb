// Adapte le projet Android généré par Capacitor : version, permissions, icônes.
// Lancé après « cap add android » (voir package.json et le workflow GitHub).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Outil de traitement d'images : « magick » (ImageMagick 7) ou « convert » (ImageMagick 6).
// Les serveurs GitHub récents ne l'ont pas toujours : on l'installe alors automatiquement.
function findIM() {
  const ok = (c) => { try { execSync(c + ' -version', { stdio: 'ignore' }); return true; } catch (e) { return false; } };
  return ['magick', 'convert'].filter(ok)[0] || null;
}
let IM = findIM();
if (!IM) {
  console.log('ImageMagick absent : installation…');
  const sudo = process.getuid && process.getuid() === 0 ? '' : 'sudo ';
  execSync(sudo + 'apt-get update -qq && ' + sudo + 'apt-get install -y -qq imagemagick', { stdio: 'inherit' });
  IM = findIM();
  if (!IM) throw new Error('ImageMagick introuvable après installation');
}

const root = path.join(__dirname, '..');
const iconSrc = path.join(root, '..', 'RakebDesktop', 'icon.png');
const app = path.join(root, 'android', 'app');
const pkg = require(path.join(root, 'package.json'));
const versionCode = parseInt(process.env.VERSION_CODE || '1', 10);

function edit(file, fn) {
  const txt = fs.readFileSync(file, 'utf8');
  const out = fn(txt);
  if (out === txt) console.warn('Aucun changement dans', path.relative(root, file));
  fs.writeFileSync(file, out);
}

// 1. Version
edit(path.join(app, 'build.gradle'), (t) =>
  t.replace(/versionCode \d+/, 'versionCode ' + versionCode)
   .replace(/versionName "[^"]*"/, 'versionName "' + pkg.version + '"'));

// 2. Permissions (la localisation vient du plugin Geolocation)
const perms = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK'
];
edit(path.join(app, 'src/main/AndroidManifest.xml'), (t) => {
  const add = perms
    .filter((p) => !t.includes(p))
    .map((p) => '    <uses-permission android:name="' + p + '" />')
    .join('\n');
  // l'écran tactile n'est pas obligatoire : l'APK reste installable sur tout appareil (tablettes, TV box…)
  const feat = '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n' +
               '    <uses-feature android:name="android.hardware.location" android:required="false" />\n';
  // Synthèse vocale (99 Noms d'Allah) : Android 11+ exige de déclarer le service
  const q = '    <queries><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>\n';
  return t.replace('</manifest>', add + '\n' + feat + q + '</manifest>');
});

// 3. Icônes (ImageMagick est installé sur les exécuteurs GitHub)
const icon = iconSrc;
const bg = execSync(IM + ' "' + icon + '" -format "#%[hex:p{256,30}]" info:').toString().trim().slice(0, 7);
edit(path.join(app, 'src/main/res/values/ic_launcher_background.xml'), (t) =>
  t.replace(/#[0-9A-Fa-f]{6,8}/, bg));
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
Object.keys(legacy).forEach((d) => {
  const dir = path.join(app, 'src/main/res', 'mipmap-' + d);
  const l = legacy[d], a = adaptive[d], inner = Math.round(a * 0.62);
  execSync(IM + ' "' + icon + '" -resize ' + l + 'x' + l + ' "' + dir + '/ic_launcher.png"');
  execSync(IM + ' "' + icon + '" -resize ' + l + 'x' + l + ' "' + dir + '/ic_launcher_round.png"');
  execSync(IM + ' "' + icon + '" -resize ' + inner + 'x' + inner +
           ' -background none -gravity center -extent ' + a + 'x' + a + ' "' + dir + '/ic_launcher_foreground.png"');
});
// Boussole native : plugin Java (lecture directe des capteurs) enregistré dans MainActivity
const javaDir = path.join(app, 'src/main/java/com/rakeb/mobile');
if (!fs.existsSync(javaDir)) throw new Error('Dossier Java introuvable : ' + javaDir);
fs.copyFileSync(path.join(root, 'android-native', 'CompassPlugin.java'), path.join(javaDir, 'CompassPlugin.java'));
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), `package com.rakeb.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CompassPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
console.log('Boussole native installée');

// Adhan facultatif pour les notifications (res/raw/adhan.*)
const resSrc = path.join(root, 'android-res');
if (fs.existsSync(resSrc)) {
  const f = fs.readdirSync(resSrc).filter((x) => /^adhan\.(mp3|ogg|wav)$/i.test(x))[0];
  if (f) {
    const raw = path.join(app, 'src/main/res/raw');
    fs.mkdirSync(raw, { recursive: true });
    fs.copyFileSync(path.join(resSrc, f), path.join(raw, f.toLowerCase()));
    console.log('Adhan copié dans res/raw :', f.toLowerCase());
  }
}
console.log('Android prêt : version', pkg.version, '(code ' + versionCode + '), fond d\'icône', bg);
