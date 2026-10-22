// Adapte le projet Android généré par Capacitor : version, permissions, icônes.
// Lancé après « cap add android » (voir package.json et le workflow GitHub).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
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
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
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
  return t.replace('</manifest>', add + '\n' + feat + '</manifest>');
});

// 3. Icônes (ImageMagick est installé sur les exécuteurs GitHub)
const icon = path.join(root, 'assets', 'icon.png');
const bg = execSync('convert "' + icon + '" -format "#%[hex:p{256,30}]" info:').toString().trim().slice(0, 7);
edit(path.join(app, 'src/main/res/values/ic_launcher_background.xml'), (t) =>
  t.replace(/#[0-9A-Fa-f]{6,8}/, bg));
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
Object.keys(legacy).forEach((d) => {
  const dir = path.join(app, 'src/main/res', 'mipmap-' + d);
  const l = legacy[d], a = adaptive[d], inner = Math.round(a * 0.62);
  execSync('convert "' + icon + '" -resize ' + l + 'x' + l + ' "' + dir + '/ic_launcher.png"');
  execSync('convert "' + icon + '" -resize ' + l + 'x' + l + ' "' + dir + '/ic_launcher_round.png"');
  execSync('convert "' + icon + '" -resize ' + inner + 'x' + inner +
           ' -background none -gravity center -extent ' + a + 'x' + a + ' "' + dir + '/ic_launcher_foreground.png"');
});
console.log('Android prêt : version', pkg.version, '(code ' + versionCode + '), fond d\'icône', bg);
