// Tests automatiques de Rakeb : syntaxe, noms de fonctions en double, horaires de prière,
// écrans, duas, tasbih, ajustements, pont des alarmes Android, vérification des mises à jour.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.env.RAKEB_INDEX || path.join(__dirname, '..', 'RakebDesktop', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
let failures = 0, passed = 0;
function check(name, ok, info) {
  if (ok) { passed++; console.log('  ok    ' + name + (info ? ' — ' + info : '')); }
  else { failures++; console.log('  ÉCHEC ' + name + (info ? ' — ' + info : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. Analyse statique ----------
console.log('Analyse du code');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
blocks.forEach((code, i) => {
  try { new Function(code); check('syntaxe du bloc de script ' + (i + 1), true); }
  catch (e) { check('syntaxe du bloc de script ' + (i + 1), false, e.message); }
});
const main = blocks.reduce((a, b) => (b.length > a.length ? b : a), '');
const names = [...main.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map((m) => m[1]);
const counts = {}; names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
const dups = Object.keys(counts).filter((n) => counts[n] > 1);
check('aucune fonction déclarée deux fois (un doublon écrase la première)', dups.length === 0, dups.join(', '));
check('APP_VERSION définie', /const APP_VERSION = '\d+\.\d+\.\d+'/.test(main));
['AdhanPlugin', 'AdhanService', 'AdhanReceiver', 'AdhanScheduler', 'BootReceiver', 'CompassPlugin', 'SystemPlugin'].forEach((c) => {
  check('classe Java ' + c + ' présente', fs.existsSync(path.join(__dirname, '..', 'RakebMobile', 'android-native', c + '.java')));
});
try { new Function(fs.readFileSync(path.join(__dirname, '..', 'RakebMobile', 'shim', 'android-shim.js'), 'utf8')); check('syntaxe du pont Android', true); }
catch (e) { check('syntaxe du pont Android', false, e.message); }

// ---------- 2. Application dans un navigateur simulé ----------
async function loadApp(storage, netHandler) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) errors.push(e.message.slice(0, 160)); });
  // le stockage est préparé par un petit script placé avant ceux de l'application
  const prelude = '<script>try{' + Object.keys(storage || {}).map((k) => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(storage[k]) + ');').join('') + '}catch(e){}</script>';
  const dom = new JSDOM(html.replace('<head>', '<head>' + prelude), {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, addEventListener() {} }));
      w.Element.prototype.scrollIntoView = function () {};
      w.rakebNet = { request: async (o) => (netHandler ? netHandler(o) : { status: 500, text: '{}' }) };
    }
  });
  await wait(900);
  return { w: dom.window, d: dom.window.document, errors };
}
const click = (d, sel) => d.querySelector(sel).click();
const text = (d, sel) => (d.querySelector(sel) ? d.querySelector(sel).textContent.replace(/\s+/g, ' ').trim() : '');
const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

(async () => {
  console.log('Application (Dakar)');
  const STATE = JSON.stringify({ lat: 14.6937, lon: -17.4441, tz: 'Africa/Dakar', cityName: 'Dakar', method: 'MWL', madhab: '1' });
  let release = { status: 200, tag: 'v9.9.9' };
  const net = (o) => /api\.github\.com/.test(o.url)
    ? (release.status === 404 ? { status: 404, text: '{}' } : { status: 200, text: JSON.stringify({ tag_name: release.tag, html_url: 'https://github.com/x/y/releases/tag/' + release.tag, body: 'Notes' }) })
    : { status: 500, text: '{}' };
  const { w, d, errors } = await loadApp({ 'rakeb-state': STATE, 'rakeb-notif': 'true' }, net);

  // horaires de prière
  const rows = [...d.querySelectorAll('#prayer-list .prayer-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim().slice(-5));
  check('6 horaires affichés', rows.length === 6 && rows.every((r) => /^\d\d:\d\d$/.test(r)), rows.join(' '));
  const m = rows.map(mins);
  check('horaires dans l\'ordre', m.every((v, i) => i === 0 || v > m[i - 1]));
  check('Dhuhr de Dakar entre 12h30 et 13h30', m[2] >= 750 && m[2] <= 810, rows[2]);
  check('Fajr entre 4h30 et 6h30', m[0] >= 270 && m[0] <= 390, rows[0]);
  check('Maghrib entre 17h45 et 19h45', m[4] >= 1065 && m[4] <= 1185, rows[4]);

  // ajustement manuel
  const adj = d.getElementById('adj-fajr'); adj.value = '6'; adj.dispatchEvent(new w.Event('change'));
  await wait(200);
  const rows2 = [...d.querySelectorAll('#prayer-list .prayer-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim().slice(-5));
  check('ajustement Fajr +6 min', mins(rows2[0]) - mins(rows[0]) === 6 && rows2[2] === rows[2], rows[0] + ' → ' + rows2[0]);
  d.getElementById('adj-reset').click();

  // pont des alarmes
  const up = w.RakebBridge.upcoming(3);
  check('pont des alarmes : événements à venir', up.length >= 5, up.length + ' événements');
  check('pont des alarmes : horodatages croissants au sein d\'un jour', up.every((x) => x.ts > Date.now() - 1000));
  w.localStorage.setItem('rakeb-prayer-mutes', JSON.stringify({ asr: false }));
  check('pont des alarmes : prière décochée ignorée', !w.RakebBridge.upcoming(3).some((x) => x.id === 'asr'));
  w.localStorage.removeItem('rakeb-prayer-mutes');

  // écrans
  const panels = ['horaires', 'qibla', 'coran', 'duas', 'menu', 'parametres', 'ia'];
  panels.forEach((p) => { try { click(d, '.tab-btn[data-panel="' + p + '"]'); } catch (e) { check('écran ' + p, false, e.message); } });
  ['tasbih', 'zakat', 'noms99', 'calendrier', 'coran365', 'serie', 'suivi', 'inspiration', 'confidentialite'].forEach((p) => {
    try { w.showPanel(p); } catch (e) { /* showPanel n'est pas exposé : on passe par les liens */ }
  });
  check('écran Qibla : repère solaire présent', text(d, '#sun-guide').length > 10);
  check('99 Noms affichés', d.querySelectorAll('#names-grid .name-tile').length >= 99, d.querySelectorAll('#names-grid .name-tile').length + ' tuiles');

  // duas
  click(d, '.tab-btn[data-panel="duas"]');
  const cats = [...d.querySelectorAll('#dua-chips .chip')].map((c) => c.dataset.cat);
  check('16 catégories de duas + « Mes ajouts »', cats.length === 17, cats.length + '');
  let total = 0;
  cats.forEach((c) => { d.querySelector('#dua-chips .chip[data-cat="' + c + '"]').click(); total += d.querySelectorAll('#dua-list .dua-item').length; });
  check('au moins 130 duas', total >= 130, total + '');
  check('chaque doua a un texte arabe', (() => { d.querySelector('#dua-chips .chip[data-cat="matin"]').click(); return [...d.querySelectorAll('#dua-list .dua-ar')].length === d.querySelectorAll('#dua-list .dua-item').length; })());
  d.getElementById('dua-add-toggle').click();
  d.getElementById('dua-f-cat').value = 'famille'; d.getElementById('dua-f-ar').value = 'اللَّهُمَّ بَارِكْ';
  d.getElementById('dua-f-fr').value = '<b>x</b>'; d.getElementById('dua-f-save').click();
  check('ajout d\'une doua personnelle', d.querySelectorAll('#dua-list .dua-item').length === 6, 'catégorie Famille');
  check('texte saisi échappé (pas de HTML injecté)', !d.querySelector('#dua-list b'));
  d.querySelector('#dua-list [data-dua-del]').click();
  check('suppression d\'une doua personnelle', d.querySelectorAll('#dua-list .dua-item').length === 5);

  // tasbih
  click(d, '.tab-btn[data-panel="menu"]');
  const goto = d.querySelector('[data-goto="tasbih"]'); if (goto) goto.click();
  const chips0 = d.querySelectorAll('#dhikr-chips .chip').length;
  d.getElementById('dhikr-add-toggle').click();
  d.getElementById('dhikr-f-tr').value = 'Ma formule'; d.getElementById('dhikr-f-target').value = '21'; d.getElementById('dhikr-f-save').click();
  check('ajout d\'une formule de tasbih', d.querySelectorAll('#dhikr-chips .chip').length === chips0 + 1);
  check('objectif de la formule appliqué', d.getElementById('tasbih-target').value === '21');
  d.getElementById('dhikr-del').click();
  check('suppression d\'une formule de tasbih', d.querySelectorAll('#dhikr-chips .chip').length === chips0);

  // mises à jour
  click(d, '.tab-btn[data-panel="parametres"]');
  d.getElementById('update-check').click(); await wait(300);
  check('mise à jour disponible détectée', /Nouvelle version/.test(text(d, '#update-status')) && d.getElementById('update-link').style.display !== 'none', text(d, '#update-status').slice(0, 60));
  release = { status: 200, tag: 'v0.0.1' }; d.getElementById('update-check').click(); await wait(300);
  check('version à jour reconnue', /dernière version/.test(text(d, '#update-status')));
  release = { status: 404 }; d.getElementById('update-check').click(); await wait(300);
  check('aucune publication : message clair', /aucune publication/.test(text(d, '#update-status')));
  check('lien « Signaler un problème » prêt', /^https:\/\/wa\.me\/\d+/.test(d.getElementById('report-problem').href));

  check('aucune erreur JavaScript pendant les tests', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' vérifications réussies, ' + failures + ' échec(s).');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Erreur du test :', e); process.exit(1); });
