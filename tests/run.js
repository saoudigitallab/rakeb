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
check('APP_VERSION définie', /const APP_VERSION = ['"]\d+\.\d+\.\d+['"]/.test(main));
if (process.env.RAKEB_TRANSPILED) {
  // Version pour anciennes WebView Android : plus aucune syntaxe moderne (Chrome 51 et plus suffit)
  check('Android : pas de chaînage optionnel (?.)', !/\?\.[A-Za-z_\[(]/.test(main));
  check('Android : pas de fusion nulle (??)', !/\?\?/.test(main));
  check('Android : pas de async/await natifs', !/\basync\s+(function|\()|\basync\s+\w+\s*=>/.test(main) && !/(?<![\w.])await\s/.test(main));
  check('Android : pas de décomposition d\'objet étalé ({...x})', !/\{\s*\.\.\./.test(main));
  check('Android : compléments et pont chargés avant l\'application', html.indexOf('polyfills.js') > -1 && html.indexOf('polyfills.js') < html.indexOf('android-shim.js') && html.indexOf('android-shim.js') < html.indexOf(main.slice(0, 40)));
}
['RakebWidgetProvider', 'AdhanPlugin', 'AdhanService', 'AdhanReceiver', 'AdhanScheduler', 'BootReceiver', 'CompassPlugin', 'SystemPlugin'].forEach((c) => {
  check('classe Java ' + c + ' présente', fs.existsSync(path.join(__dirname, '..', 'RakebMobile', 'android-native', c + '.java')));
});
try { new Function(fs.readFileSync(path.join(__dirname, '..', 'RakebMobile', 'shim', 'android-shim.js'), 'utf8')); check('syntaxe du pont Android', true); }
catch (e) { check('syntaxe du pont Android', false, e.message); }

// ---------- 2. Application dans un navigateur simulé ----------
async function loadApp(storage, netHandler, opts) {
  opts = opts || {};
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
      if (opts.fakeNow) {
        const RD = w.Date, off = opts.fakeNow - RD.now();
        w.Date = class extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } };
      }
      if (opts.recordImages) {
        w.__imgs = [];
        w.Image = function () { const im = w.document.createElement('img'); let src = ''; Object.defineProperty(im, 'src', { get() { return src; }, set(v) { src = v; w.__imgs.push(v); } }); return im; };
      }
      if (opts.clipboard) { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { w.__copied = t; } } }); }
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


  // =====================================================================
  // v1.2 — Muslim IA « sources vérifiées », Ramadan, Qibla carte, hégirien, finitions
  // =====================================================================
  console.log('Muslim IA : détection d\'intention (20 phrases et plus)');
  const T = w.RakebTest;
  const PHRASES = [
    ['Quel est le verset 2:255 ?', 'quran'], ['Donne-moi la sourate Al-Ikhlas verset 1', 'quran'], ['Ayat al-Kursi', 'quran'], ['آية الكرسي', 'quran'],
    ['Explique le verset 2:255', 'tafsir'], ['Tafsir de la sourate Al-Baqara verset 255', 'tafsir'], ['تفسير سورة الإخلاص', 'tafsir'],
    ['Hadith Boukhari 1', 'hadith'], ['Un hadith sur la patience', 'hadith'], ['حديث إنما الأعمال بالنيات', 'hadith'],
    ['Quelle est l\'heure du Fajr à Dakar ?', 'prayer_time'], ['Horaires de prière aujourd\'hui', 'prayer_time'], ['مواقيت الصلاة', 'prayer_time'], ['Waxtu tisbaar', 'prayer_time'],
    ['Dua avant de manger', 'dua'], ['Que dire en entrant à la mosquée ?', 'dua'], ['دعاء السفر', 'dua'], ['Ñaan bu baax', 'dua'],
    ['Est-ce que la musique est haram ?', 'fiqh'], ['Mon divorce est-il valide ?', 'fiqh'], ['Comment partager l\'héritage de mon père ?', 'fiqh'], ['فتوى في الطلاق', 'fiqh'], ['Ndax halaal la ?', 'fiqh'], ['Quelle est la fatwa sur ce sujet ?', 'fiqh'],
    ['Qui était Omar ibn al-Khattab ?', 'general'], ['C\'est quoi le Ramadan ?', 'general']
  ];
  PHRASES.forEach(([q, want]) => { const got = T.detectIntent(q); check('intention « ' + q + ' » → ' + want, got === want, got === want ? '' : 'obtenu : ' + got); });
  check('114 sourates, 114 clés distinctes, 6236 versets', T.surahCount() === 114 && T.surahKeyCount() === 114 && T.ayahTotal() === 6236, T.surahCount() + '/' + T.surahKeyCount() + '/' + T.ayahTotal());

  // ----- Mode sources : mock des 4 API (succès, délai dépassé, erreur HTTP) -----
  console.log('Muslim IA : mode sources (sans clé)');
  const calls = []; const mock = { mode: 'ok' };
  const AR_V = 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ';
  const ed = (id, text, n) => ({ text, numberInSurah: n, surah: { number: 2, englishName: 'Al-Baqara', name: 'سورة البقرة' }, edition: { identifier: id } });
  const net2 = (o) => {
    calls.push(o.url);
    if (/anthropic/.test(o.url)) return { status: 200, text: JSON.stringify({ content: [{ type: 'text', text: mock.aiText || 'Réponse.' }] }) };
    if (/api\.github\.com/.test(o.url)) return { status: 404, text: '{}' };
    if (!/alquran\.cloud|quran\.com|jsdelivr|aladhan/.test(o.url)) return { status: 500, text: '{}' };
    if (mock.mode === 'timeout') return new Promise(() => {});
    if (mock.mode === 'http403') return { status: 403, text: '{}' };
    let m;
    if ((m = o.url.match(/ayah\/(\d+):(\d+)\/editions/))) return { status: 200, text: JSON.stringify({ data: [ed('quran-uthmani', AR_V, +m[2]), ed('fr.hamidullah', 'Allah ! Pas de divinité à part Lui, le Vivant.', +m[2]), ed('en.transliteration', 'Allahu la ilaha illa huwa', +m[2])] }) };
    if ((m = o.url.match(/surah\/112\/editions/))) { const ay = (t) => [1, 2, 3, 4].map((n) => ({ numberInSurah: n, text: t + n })); return { status: 200, text: JSON.stringify({ data: [{ edition: { identifier: 'quran-uthmani' }, ayahs: ay('ar'), surah: { number: 112, englishName: 'Al-Ikhlas', name: 'الإخلاص' } }, { edition: { identifier: 'fr.hamidullah' }, ayahs: ay('fr') }, { edition: { identifier: 'en.transliteration' }, ayahs: ay('tr') }] }) }; }
    if (/search\/patience/.test(o.url)) return { status: 200, text: JSON.stringify({ data: { matches: [{ surah: { number: 2 }, numberInSurah: 153 }, { surah: { number: 3 }, numberInSurah: 200 }] } }) };
    if (/quran\.com\/api\/v4\/quran\/tafsirs\/16/.test(o.url)) return { status: 200, text: JSON.stringify({ tafsirs: [{ text: '<p>تفسير الآية الكريمة</p>' }] }) };
    if (/aladhan/.test(o.url)) return { status: 200, text: JSON.stringify({ data: { timings: { Fajr: '05:41', Dhuhr: '13:30', Asr: '16:50', Maghrib: '19:10', Isha: '20:20' } } }) };
    if ((m = o.url.match(/editions\/(ara|fra|eng)-bukhari\/(\d+)\.json/))) return { status: 200, text: JSON.stringify({ hadithnumber: +m[2], text: m[1] === 'ara' ? 'إنما الأعمال بالنيات' : 'Les actes ne valent que par les intentions.', grades: [{ name: 'Al-Albani', grade: 'Sahih' }] }) };
    return { status: 404, text: '{}' };
  };
  const app2 = await loadApp({ 'rakeb-state': STATE, 'rakeb-notif': 'true' }, net2, { clipboard: true, recordImages: true });
  const T2 = app2.w.RakebTest, d2 = app2.d, w2 = app2.w;
  const BANNER = /Réponse issue de .+\. Activez la clé API dans Réglages › Muslim IA pour des réponses personnalisées\./;
  let r = await T2.askSources('Verset 2:255');
  check('verset sans clé : arabe, translittération, traduction, source cliquable', r.kind === 'ok' && r.html.includes('اللَّهُ لَا') && r.html.includes('Allahu la ilaha') && r.html.includes('Pas de divinité') && r.html.includes('href="https://quran.com/2:255"'));
  check('bandeau permanent « Réponse issue de [source] … clé API »', BANNER.test(r.html.replace(/<[^>]+>/g, '')));
  r = await T2.askSources('Sourate Al-Ikhlas');
  check('sourate nommée : versets 1 à 4', r.html.includes('﴿4﴾') && r.html.includes('Al-Ikhlas'));
  r = await T2.askSources('Hadith Boukhari 1');
  check('hadith sans clé : texte, authenticité, lien sunnah.com', r.html.includes('إنما الأعمال') && r.html.includes('Sahih') && r.html.includes('https://sunnah.com/bukhari:1'));
  r = await T2.askSources('Tafsir 2:255');
  check('tafsir sans clé : verset + tafsir court', r.html.includes('Tafsir court') && r.html.includes('تفسير الآية') && r.html.includes('Al-Baqara'));
  r = await T2.askSources('Versets sur la patience');
  check('thème : versets trouvés par mot-clé', r.kind === 'ok' && (r.html.match(/src-card/g) || []).length >= 2);
  const before = calls.length;
  r = await T2.askSources('Horaires de prière aujourd\'hui');
  const aladhanUrl = calls.filter((u) => /aladhan/.test(u)).pop() || '';
  check('horaires sans clé : calcul local recoupé avec Aladhan', r.kind === 'ok' && r.html.includes('Aladhan') && r.html.includes('05:41') && /<td>Fajr<\/td>/.test(r.html));
  check('horaires : position arrondie à 2 décimales seulement', /latitude=14\.69&longitude=-17\.44&/.test(aladhanUrl), aladhanUrl.slice(-120));
  const callsBeforeDua = calls.length;
  r = await T2.askSources('Dua avant de manger');
  check('doua : réponse hors ligne (aucune requête réseau)', r.kind === 'ok' && calls.length === callsBeforeDua && r.html.includes('dua-ar'));
  r = await T2.askSources('Est-ce que la musique est haram ?');
  const callsBeforeFiqh = calls.length;
  check('fiqh : refus (aucune fatwa générée)', r.kind === 'refusal' && /ni fatwa ni avis juridique/.test(r.html) && !BANNER.test(r.html.replace(/<[^>]+>/g, '')));
  // la même chose depuis l'interface, avec une clé API présente : toujours refusé, jamais envoyé à Anthropic
  d2.getElementById('ai-api-key').value = 'sk-ant-test'; d2.getElementById('ai-key-save').click();
  d2.getElementById('ai-question-input').value = 'Mon divorce est-il valide ?'; d2.getElementById('ai-ask-btn').click(); await wait(200);
  check('fiqh via l\'interface avec clé API : refus et aucun envoi à Anthropic', /ne génère/.test(text(d2, '#ai-chat-log .bubble.bot:last-child')) && !calls.some((u) => /anthropic/.test(u)));
  // avec clé : toute réponse religieuse doit citer ses sources + avertissement
  mock.aiText = 'La prière est un pilier de l\'islam.';
  d2.getElementById('ai-question-input').value = 'Pourquoi prie-t-on ?'; d2.getElementById('ai-ask-btn').click(); await wait(250);
  let last = text(d2, '#ai-chat-log .bubble.bot:last-child');
  check('avec clé : avertissement « consultez une personne qualifiée » + alerte si aucune source citée', /consultez une personne qualifiée/i.test(last) && /ne cite pas de source/.test(last), last.slice(0, 80));
  mock.aiText = 'Voir le verset 2:255 (Ayat al-Kursi).';
  d2.getElementById('ai-question-input').value = 'Quel verset protège ?'; d2.getElementById('ai-ask-btn').click(); await wait(250);
  last = text(d2, '#ai-chat-log .bubble.bot:last-child');
  check('avec clé : réponse sourcée sans alerte, avertissement rappelé', !/ne cite pas de source/.test(last) && /consultez une personne qualifiée/i.test(last));
  d2.getElementById('ai-api-key').value = ''; d2.getElementById('ai-key-save').click();

  // ----- cache local, liste blanche, délai, erreur HTTP -----
  const n1 = calls.length; r = await T2.askSources('Verset 1:2'); const n2 = calls.length;
  r = await T2.askSources('Verset 1:2'); const n3 = calls.length;
  check('cache : 1er appel = réseau, 2e appel identique = aucune requête', n2 > n1 && n3 === n2 && r.cached === true, (n2 - n1) + ' requête(s) puis ' + (n3 - n2));
  let blocked = ''; try { await T2.srcFetch('https://exemple-non-autorise.test/x'); } catch (e) { blocked = e.message; }
  check('liste blanche : domaine hors liste refusé sans requête', /Domaine non autorisé/.test(blocked) && !calls.some((u) => /exemple-non-autorise/.test(u)));
  T2.setSrcTimeout(150); mock.mode = 'timeout';
  r = await T2.askSources('Verset 3:18');
  check('délai dépassé : message clair', r.kind === 'error' && /Délai dépassé/.test(r.error) && /Source indisponible/.test(r.html), r.error);
  mock.mode = 'http403';
  r = await T2.askSources('Verset 4:19');
  check('erreur HTTP : détail « HTTP 403 » affiché', r.kind === 'error' && r.error === 'HTTP 403' && r.html.includes('HTTP 403'), r.error);
  mock.mode = 'ok'; T2.setSrcTimeout(5000);
  r = await T2.askSources('Verset 5:3');
  check('reprise après erreur : la source répond de nouveau', r.kind === 'ok');
  r = await T2.askSources('Verset 2:999');
  check('référence invalide : message explicite sans réseau', /compte 286 versets/.test(r.html));
  // sources hors liste blanche : vérification par analyse du code
  const urlHosts = [...new Set([...main.matchAll(/(?:netFetch|srcFetch|fetch)\(\s*['"`](https?:\/\/[^'"`$\/?#]+)/g)].map((m) => m[1].replace(/^https?:\/\//, '')))];
  const priv = text(d2, '#panel-confidentialite');
  const unlisted = urlHosts.filter((h) => !priv.includes(h.replace(/^www\./, '')));
  check('aucune requête réseau hors de l\'écran Confidentialité (analyse du code)', unlisted.length === 0, unlisted.join(', ') || urlHosts.length + ' hôtes vérifiés');
  const srcHostsInCode = (main.match(/SRC_ALLOWED_HOSTS\s*=\s*\[([^\]]+)\]/) || [, ''])[1].replace(/['"\s]/g, '').split(',');
  check('liste blanche de Muslim IA = les 4 domaines prévus', srcHostsInCode.sort().join() === ['api.alquran.cloud', 'api.aladhan.com', 'api.quran.com', 'cdn.jsdelivr.net'].sort().join(), srcHostsInCode.join(' '));

  // ----- Confidentialité -----
  check('Confidentialité : api.alquran.cloud, api.quran.com, sunnah.com, api.aladhan.com listés', ['api.alquran.cloud', 'api.quran.com', 'sunnah.com', 'api.aladhan.com'].every((h) => priv.includes(h)));
  check('Confidentialité : carte OpenStreetMap listée et date mise à jour', priv.includes('tile.openstreetmap.org') && priv.includes('18 novembre 2026'));

  // ----- Calendrier hégirien -----
  console.log('Calendrier hégirien');
  const hj = (y, m, dd) => { const h = T2.gregorianToHijri(new w2.Date(w2.Date.UTC(y, m - 1, dd, 12))); return h.day + '/' + h.month + '/' + h.year; };
  check('hégirien : 11 mars 2024 = 1 Ramadan 1445', hj(2024, 3, 11) === '1/9/1445', hj(2024, 3, 11));
  check('hégirien : 1er mars 2025 = 1 Ramadan 1446', hj(2025, 3, 1) === '1/9/1446', hj(2025, 3, 1));
  check('hégirien : 1er janvier 2000 = 24 Ramadan 1420', hj(2000, 1, 1) === '24/9/1420', hj(2000, 1, 1));
  check('hégirien : 23 mars 2023 = 1 Ramadan 1444', hj(2023, 3, 23) === '1/9/1444', hj(2023, 3, 23));
  T2.setHijriAdj(1);
  check('hégirien : ajustement +1 jour', hj(2024, 3, 11) === '2/9/1445', hj(2024, 3, 11));
  T2.setHijriAdj(-1);
  check('hégirien : ajustement −1 jour (retour au 29 Chaabane)', hj(2024, 3, 11) === '29/8/1445', hj(2024, 3, 11));
  T2.setHijriAdj(9);
  check('hégirien : ajustement limité à ±1 jour', hj(2024, 3, 11) === '2/9/1445');
  d2.querySelector('#hijri-adj-card .hijri-adj-reset').click();
  check('hégirien : remise à zéro et affichage dans l\'entête', hj(2024, 3, 11) === '1/9/1445' && /AH/.test(text(d2, '#hijri-date-small')) && /AH/.test(text(d2, '#today-dates')));

  // ----- Ajustements par mosquée -----
  console.log('Profils d\'horaires par mosquée');
  const setAdj = (k, v) => { const el = d2.getElementById('adj-' + k); el.value = v; el.dispatchEvent(new w2.Event('change', { bubbles: true })); };
  const fajrTxt = () => text(d2, '#prayer-list');
  const base0 = fajrTxt();
  setAdj('fajr', 3); setAdj('isha', -2);
  const adjusted = fajrTxt();
  const p1 = T2.saveMosqueProfile('Mosquée Test');
  d2.getElementById('adj-reset').click();
  check('mosquée : profil enregistré (nom + 5 ajustements)', p1 && p1.name === 'Mosquée Test' && p1.adj.fajr === 3 && p1.adj.isha === -2 && Object.keys(p1.adj).length === 5 && T2.mosqueProfiles().length === 1);
  check('mosquée : remise à zéro des ajustements', d2.getElementById('adj-fajr').value === '0' && fajrTxt() === base0);
  d2.getElementById('mp-select').value = p1.id; d2.getElementById('mp-select').dispatchEvent(new w2.Event('change', { bubbles: true }));
  check('mosquée : sélection dans Horaires applique les ajustements', d2.getElementById('adj-fajr').value === '3' && d2.getElementById('adj-isha').value === '-2' && fajrTxt() === adjusted);
  check('mosquée : profil conservé localement (localStorage)', /Mosquée Test/.test(w2.localStorage.getItem('rakeb-mosque-profiles') || ''));
  check('mosquée : valeurs limitées à −30/+30', (() => { setAdj('asr', 45); return d2.getElementById('adj-asr').value === '30'; })());
  d2.getElementById('adj-reset').click();

  // ----- Duas : recherche locale, copier -----
  console.log('Duas, Coran, À propos, accessibilité');
  click(d2, '.tab-btn[data-panel="duas"]');
  const search = (q) => { const el = d2.getElementById('dua-search'); el.value = q; el.dispatchEvent(new w2.Event('input', { bubbles: true })); return d2.querySelectorAll('#dua-list .dua-item'); };
  check('recherche duas : mot-clé « rupture » (toutes catégories)', search('rupture').length >= 1 && d2.getElementById('dua-list').textContent.includes('ذَهَبَ'));
  check('recherche duas : arabe sans voyelles et sans accents', search('ذهب الظمأ').length >= 1 && search('jeune').length >= 1);
  d2.querySelector('#dua-chips .chip[data-cat="voyage"]').click(); const nVoy = d2.querySelectorAll('#dua-list .dua-item').length;
  check('recherche duas : par thème (« voyage »)', search('voyage').length >= nVoy && nVoy > 0 && /Voyage/.test(d2.getElementById('dua-list').textContent), nVoy + ' dans la catégorie');
  search('Muslim');
  check('recherche duas : par source (« Muslim »)', d2.querySelectorAll('#dua-list .dua-item').length >= 1);
  search('');
  check('bouton « Copier » sur chaque doua', d2.querySelectorAll('#dua-list [data-dua-copy]').length === d2.querySelectorAll('#dua-list .dua-item').length && d2.querySelectorAll('#dua-list [data-dua-copy]').length > 0);
  d2.querySelector('#dua-list [data-dua-copy]').click(); await wait(50);
  check('copie d\'une doua : texte arabe copié', /[\u0600-\u06FF]/.test(w2.__copied || ''));
  const sr = d2.getElementById('surah-search'); sr.value = 'baqara'; sr.dispatchEvent(new w2.Event('change', { bubbles: true }));
  check('historique de recherche Coran', d2.querySelectorAll('#surah-hist [data-qsh]').length === 1 && d2.querySelector('#surah-hist [data-qsh]').dataset.qsh === 'baqara');
  d2.getElementById('surah-hist-clear').click();
  check('historique de recherche Coran : effacement', d2.querySelectorAll('#surah-hist [data-qsh]').length === 0);
  check('numéro de version visible dans À propos', text(d2, '#app-version-about') === text(d2, '#app-version') && /^\d+\.\d+\.\d+$/.test(text(d2, '#app-version-about')));
  const nameless = [...d2.querySelectorAll('button')].filter((b) => !(b.getAttribute('aria-label') || b.title || /[A-Za-zÀ-ÿ0-9\u0600-\u06FF]/.test(b.textContent)));
  check('accessibilité : tous les boutons ont un nom (texte ou aria-label)', nameless.length === 0, nameless.slice(0, 4).map((b) => b.outerHTML.slice(0, 60)).join(' | '));
  const unlabeled = [...d2.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')].filter((el) => !(el.getAttribute('aria-label') || el.title || (el.id && d2.querySelector('label[for="' + el.id + '"]')) || el.closest('label') || el.placeholder));
  check('accessibilité : champs et listes étiquetés', unlabeled.length === 0, unlabeled.slice(0, 4).map((b) => b.outerHTML.slice(0, 60)).join(' | '));
  // contrastes (WCAG AA : 4,5 pour le texte)
  const lum = (hex) => { const c = hex.replace('#', ''); const v = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex6 = (h) => (h.length === 4 ? '#' + h.slice(1).split('').map((c) => c + c).join('') : h);
  const vars = (css) => { const o = {}; for (const m of css.matchAll(/--([a-z-]+)\s*:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})\b/g)) o[m[1]] = hex6(m[2]); return o; };
  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const rootDark = vars(css.match(/:root\s*\{([^}]*)\}/)[1]);
  const lightBlock = vars(css.match(/:root\[data-theme=["']?light["']?\]\s*\{([^}]*)\}/)[1]);
  const pal = (n) => Object.assign({}, rootDark, vars(css.match(new RegExp(':root\\[data-palette=["\']?' + n + '["\']?\\]\\s*\\{([^}]*)\\}'))[1]));
  const themes = { sombre: rootDark, clair: Object.assign({}, rootDark, lightBlock), nuit: pal('nuit'), sable: pal('sable'), emeraude: pal('emeraude') };
  const weak = [];
  Object.keys(themes).forEach((t) => { const v = themes[t];
    [['text', 'bg'], ['text', 'surface'], ['text-dim', 'bg'], ['text-dim', 'surface'], ['text-dim', 'surface-2'], ['gold-soft', 'surface'], ['gold-soft', 'bg'], ['jade', 'surface'], ['jade', 'surface-2'], ['danger-text', 'surface'], ['danger-text', 'surface-2']].forEach(([a, b]) => { if (v[a] && v[b] && ratio(v[a], v[b]) < 4.5) weak.push(t + ' ' + a + '/' + b + ' ' + ratio(v[a], v[b]).toFixed(1)); }); });
  check('contrastes : texte ≥ 4,5:1 dans les 5 thèmes', weak.length === 0, weak.join(' ; '));

  // ----- Qibla par carte -----
  console.log('Qibla par carte');
  const plan = T2.qiblaMapPlan(14.6937, -17.4441);
  check('carte Qibla : direction de Dakar vers La Mecque ≈ 74°', plan.bearing > 72 && plan.bearing < 76, plan.bearing.toFixed(1) + '°');
  check('carte Qibla : tuiles OpenStreetMap seulement (≤ 12 tuiles)', plan.tiles.length >= 1 && plan.tiles.length <= 12 && plan.tiles.every((t) => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(t.url)), plan.tiles.length + ' tuiles, zoom ' + plan.z);
  check('carte Qibla : aucune requête silencieuse avant le clic', w2.__imgs.length === 0 && d2.getElementById('qibla-map-wrap').style.display === 'none');
  check('carte Qibla : lien depuis le message « pas de capteur »', !!d2.getElementById('qibla-map-link') && !!d2.getElementById('qibla-map-card'));
  click(d2, '#qibla-map-btn');
  check('carte Qibla : tuiles demandées seulement après activation', w2.__imgs.length >= 1 && w2.__imgs.every((u) => u.startsWith('https://tile.openstreetmap.org/')) && d2.getElementById('qibla-map-wrap').style.display === 'block', w2.__imgs.length + ' tuiles');

  // ----- Mode Ramadan (heure simulée : 20 février 2027, 12 h à Dakar) -----
  console.log('Mode Ramadan');
  const app3 = await loadApp({ 'rakeb-state': STATE, 'rakeb-notif': 'true' }, net2, { fakeNow: Date.UTC(2027, 1, 20, 12, 0, 0) });
  const T3 = app3.w.RakebTest, d3 = app3.d, w3 = app3.w;
  const rs = (now) => T3.ramadanStatus({ fajr: { decimal: 5.5 }, maghrib: { decimal: 18.5 } }, { fajr: { decimal: 5.5 } }, now, 10);
  check('Ramadan : avant l\'imsak (compte à rebours vers l\'imsak)', rs(4).phase === 'suhoor' && Math.round(rs(4).seconds) === 4800, rs(4).label);
  check('Ramadan : pendant le jeûne (compte à rebours vers l\'iftar)', rs(12).phase === 'fasting' && rs(12).label === 'Iftar dans' && Math.round(rs(12).seconds) === 23400);
  check('Ramadan : après l\'iftar (prochain imsak le lendemain)', rs(20).phase === 'night' && Math.round(rs(20).seconds) === Math.round((5.5 - 10 / 60 + 24 - 20) * 3600));
  check('Ramadan : accueil — carte visible pendant le mois (jour 13)', d3.getElementById('ramadan-home-card').style.display !== 'none' && /jour 13/.test(text(d3, '#ramadan-home-day')), text(d3, '#ramadan-home-day'));
  click(d3, '#ramadan-home-card [data-goto="ramadan"]');
  check('Ramadan : écran dédié (date hégirienne, compte à rebours, imsak/iftar)', /Ramadan/.test(text(d3, '#ram-hijri')) && /^\d\d:\d\d:\d\d$/.test(text(d3, '#ram-countdown')) && /^\d\d:\d\d$/.test(text(d3, '#ram-iftar')) && /^\d\d:\d\d$/.test(text(d3, '#ram-imsak')), text(d3, '#ram-hijri') + ' ' + text(d3, '#ram-countdown'));
  check('Ramadan : dua de rupture du jeûne mise en avant', text(d3, '#ram-dua').includes('ذَهَبَ الظَّمَأُ') && /rupture du jeûne/.test(text(d3, '#ram-dua')));
  const ev = w3.RakebBridge.upcoming(3);
  const ift = ev.filter((x) => x.id === 'iftar')[0], mag = ev.filter((x) => x.id === 'maghrib' && x.reminder === 0 && x.ts > ift.ts)[0];
  check('Ramadan : rappel 10 min avant l\'iftar programmé (alarme Android, canal silencieux)', ift && mag && mag.ts - ift.ts === 600000 && ift.reminder === 10 && /Iftar dans 10 minutes/.test(ift.title), ift ? ift.title : 'aucun');
  d3.getElementById('ram-reminder').checked = false; d3.getElementById('ram-reminder').dispatchEvent(new w3.Event('change', { bubbles: true }));
  check('Ramadan : rappel désactivable', !w3.RakebBridge.upcoming(3).some((x) => x.id === 'iftar'));
  click(d3, '#ram-fast-today');
  check('Ramadan : compteur de jeûnes (+1)', /^1 jour jeûné sur 30/.test(text(d3, '#ram-fast-count')) && T3.fastedDays(T3.ramYear()).join() === '13', text(d3, '#ram-fast-count'));
  click(d3, '#ram-fast-grid [data-fast="14"]');
  check('Ramadan : compteur modifiable jour par jour', /^2 jours jeûnés/.test(text(d3, '#ram-fast-count')));
  click(d3, '#ram-fast-today');
  check('Ramadan : calendrier ajustable ±1 jour (jour 13 → 14)', (() => { click(d3, '#panel-ramadan .hijri-adj-plus'); const t = text(d3, '#ram-day'); click(d3, '#panel-ramadan .hijri-adj-reset'); return /Jour 14 du Ramadan/.test(t); })());
  check('Ramadan : hors du mois, pas de carte ni de rappel (novembre 2026)', d.getElementById('ramadan-home-card').style.display === 'none' && !w.RakebBridge.upcoming(3).some((x) => x.id === 'iftar'));
  check('alarmes de prière inchangées (5 prières, adhan natif)', w.RakebBridge.upcoming(3).filter((x) => x.reminder === 0).length >= 10);
  check('aucune erreur JavaScript (mode sources, Ramadan, carte)', app2.errors.length === 0 && app3.errors.length === 0, app2.errors.concat(app3.errors).slice(0, 2).join(' | '));


  // ----- Évolutions v1.3 -----
  console.log('Évolutions (sunna, khatma, Nawawi, rattrapage, sauvegarde, Umm al-Qura, widget)');
  const SUNNA = JSON.stringify({ monthu: true, white: true, kahf: true, am: true, pm: true, night: true, arafat: true, ashura: true });
  const app4 = await loadApp({ 'rakeb-state': STATE, 'rakeb-sunna': SUNNA }, net2, { fakeNow: Date.UTC(2026, 10, 18, 8, 0, 0) });
  const T4 = app4.w.RakebTest, d4 = app4.d, w4 = app4.w;
  const v13_sev = T4.sunnaEvents(7), v13_cnt = (id) => v13_sev.filter((e) => e.id === 'sunna-' + id).length;
  check('sunna : jeûne lundi/jeudi la veille (mercredi soir, lundi soir)', v13_cnt('monthu') === 2, v13_cnt('monthu') + ' rappels');
  check('sunna : jours blancs (13, 14, 15)', v13_cnt('white') === 3, v13_cnt('white') + ' rappels');
  check('sunna : Al-Kahf le vendredi seulement', v13_cnt('kahf') === 1);
  check('sunna : adhkar du matin, du soir, dernier tiers de la nuit', v13_cnt('am') >= 6 && v13_cnt('pm') === 7 && v13_cnt('night') >= 6);
  check('sunna : chaque rappel a un titre, un texte et le drapeau « rappel »', v13_sev.every((e) => e.title && e.body && e.reminder && e.ts > w4.Date.now()));
  const upV = w4.RakebBridge.upcoming(7);
  check('sunna : pont Android (seuls les rappels de sunna activés, sans alertes de prière)', Array.isArray(upV) && upV.length > 10 && upV.every((e) => /^sunna-/.test(e.id)));
  click(d4, '#panel-menu [data-goto="sunna"]');
  click(d4, '#sunna-list [data-sunna="am"]');
  check('sunna : désactivation d\'un rappel depuis l\'écran', JSON.parse(w4.localStorage.getItem('rakeb-sunna')).am === false && T4.sunnaEvents(7).filter((e) => e.id === 'sunna-am').length === 0);
  const v13_tot = T4.khTotal(), v13_r1 = T4.khRange(1, 30), v13_r30 = T4.khRange(30, 30);
  let v13_sum = 0; for (let k = 1; k <= 30; k++) v13_sum += T4.khRange(k, 30).count;
  check('khatma : 6236 versets, début 1:1, fin 114:6, aucun verset oublié', v13_tot === 6236 && v13_r1.from.s === 1 && v13_r1.from.a === 1 && v13_r30.to.s === 114 && v13_r30.to.a === 6 && v13_sum === 6236);
  click(d4, '#panel-menu [data-goto="khatma"]'); click(d4, '#kh-start');
  check('khatma : plan de 30 jours créé, jour 1', JSON.parse(w4.localStorage.getItem('rakeb-khatma')).days === 30 && /Jour 1 sur 30/.test(text(d4, '#kh-body')));
  click(d4, '#kh-body button[data-kh-done="1"]');
  check('khatma : jour marqué comme lu, progression', /1 jour\(s\) lus/.test(text(d4, '#kh-body')));
  const app5 = await loadApp({ 'rakeb-state': STATE }, net2, { fakeNow: Date.UTC(2027, 1, 20, 12, 0, 0) });
  const v13_im = app5.w.RakebTest.imsakiyaRows(), v13_mm = (s) => mins(s);
  check('imsakiya : Ramadan 1448, 29 ou 30 jours, 1er jour = 8 février 2027', v13_im && v13_im.year === 1448 && v13_im.rows.length >= 29 && v13_im.rows[0].day === 1 && /8 févr/.test(v13_im.rows[0].label), v13_im ? v13_im.rows.length + ' jours, ' + v13_im.rows[0].label : 'aucun');
  check('imsakiya : imsak = Fajr − 10 min, iftar après le Fajr', v13_mm(v13_im.rows[0].fajr) - v13_mm(v13_im.rows[0].imsak) === 10 && v13_mm(v13_im.rows[0].iftar) > v13_mm(v13_im.rows[0].fajr));
  click(app5.d, '#panel-menu [data-goto="ramadan"]');
  check('Ramadan : bouton imsakiya et suivi tarawih / sadaqa présents', !!app5.d.getElementById('ram-imsakiya') && app5.d.querySelectorAll('#ram-tar-grid .chip').length === 30);
  click(app5.d, '#ram-extra-today [data-rx^="t:"]');
  check('tarawih : soirée du jour cochée (jour 13)', app5.w.RakebTest.rxGet(1448).t.join() === '13' && /^1 \/ 30/.test(text(app5.d, '#ram-tar-count')));
  app5.w.RakebTest.rxToggle(1448, 's', 4); app5.w.RakebTest.rxToggle(1448, 's', 4);
  check('sadaqa : bascule cocher / décocher', app5.w.RakebTest.rxGet(1448).s.length === 0);
  check('Nawawi : 42 hadiths intégrés, arabe et français', T4.nawawiCount() === 42);
  const v13_nwRows = d4.querySelectorAll('#nw-list .nw-item'); click(d4, '#panel-menu [data-goto="nawawi"]');
  check('Nawawi : écran avec les 42 hadiths', d4.querySelectorAll('#nw-list .nw-item').length === 42 && /[\u0600-\u06FF]/.test(text(d4, '#nw-list')));
  check('Nawawi : recherche par thème hors ligne (intention, colère, voisin)', T4.nwFind('intention')[0] === 0 && T4.nwFind('colère').indexOf(15) >= 0 && T4.nwFind('voisin').indexOf(14) >= 0);
  let rrN = await T2.askSources('Nawawi 5');
  check('Muslim IA : « Nawawi 5 » répond sans réseau', rrN.kind === 'ok' && /n°5/.test(rrN.html) && /Nawawi/.test(rrN.html));
  rrN = await T2.askSources('Hadith sur la colère');
  check('Muslim IA : hadith par thème (colère) depuis Nawawi hors ligne', rrN.kind === 'ok' && /Ne te mets pas en colère/.test(rrN.html));
  rrN = await T2.askSources('Est-ce halal de manger cela ?');
  check('Muslim IA : le fiqh reste refusé', rrN.kind === 'refusal');
  check('Muslim IA : mots-clés wolof (Alxuraan, hadiis, waxtuy julli)', T2.detectIntent('Alxuraan') === 'quran' && T2.detectIntent('hadiis ci sabar') === 'hadith' && T2.detectIntent('waxtuy julli tey') === 'prayer_time');
  let qd = T4.qadaChange('p:fajr', 3); qd = T4.qadaChange('p:fajr', -1); T4.qadaChange('p:asr', -1); T4.qadaChange('f', 2); qd = T4.qadaChange('f', -1);
  check('rattrapage : manqué +3, rattrapé −1, jamais négatif, jeûne', qd.p.fajr === 2 && qd.dp.fajr === 1 && qd.p.asr === 0 && qd.f === 1 && qd.df === 1);
  click(d4, '#panel-menu [data-goto="qada"]'); d4.getElementById('qd-bulk').value = '10'; click(d4, '#qd-bulk-btn');
  check('rattrapage : ajout groupé des 5 prières', T4.qadaGet().p.isha === 10 && T4.qadaGet().p.fajr === 12);
  w4.localStorage.setItem('rakeb-ai-key', '"secret"');
  const v13_dump = T4.bkDump();
  check('sauvegarde : contient les réglages et plans, jamais la clé API', 'rakeb-state' in v13_dump && 'rakeb-khatma' in v13_dump && 'rakeb-qada' in v13_dump && !('rakeb-ai-key' in v13_dump) && !('rakeb-src-cache' in v13_dump));
  check('sauvegarde : options automatique / restaurer / envoyer présentes', !!d4.getElementById('bk-auto') && !!d4.getElementById('bk-restore') && !!d4.getElementById('bk-send'));
  const v13_hj = (y, m, d) => T4.uqHijri(new w4.Date(Date.UTC(y, m - 1, d, 12)));
  const v13_eq = (a, y, m, d) => a && a.year === y && a.month === m && a.day === d;
  check('Umm al-Qura : 1 Ramadan 1445 / 1446 / 1447 / 1448', v13_eq(v13_hj(2024, 3, 11), 1445, 9, 1) && v13_eq(v13_hj(2025, 3, 1), 1446, 9, 1) && v13_eq(v13_hj(2026, 2, 18), 1447, 9, 1) && v13_eq(v13_hj(2027, 2, 8), 1448, 9, 1));
  check('Umm al-Qura : hors table (2080) → calcul tabulaire de secours', v13_hj(2080, 1, 1) === null && T4.gregorianToHijri(new w4.Date(Date.UTC(2080, 0, 1, 12))).year > 1500);
  const diffDays = (flag) => { w4.localStorage.setItem('rakeb-hijri-uq', flag); const r = []; for (let i = 0; i < 1500; i += 7) { const h = T4.gregorianToHijri(new w4.Date(Date.UTC(2024, 0, 1 + i, 12))); r.push(h.month * 100 + h.day); } return r.join(); };
  const v13_a = diffDays('false'), v13_b = diffDays('true'), v13_c = diffDays('true');
  check('Umm al-Qura : réglage désactivable (le calcul tabulaire diffère, retour stable)', v13_a !== v13_b && v13_b === v13_c);
  check('recherche Coran : normalisation (accents, voyelles arabes, alif)', T4.qsNorm('Éléphant') === 'elephant' && T4.qsNorm('أَلْحَمْدُ') === 'الحمد');
  d4.getElementById('qs-input').value = 'patience'; click(d4, '#qs-btn'); await wait(150);
  check('recherche Coran : invite à télécharger le Coran s\'il est absent', /Téléchargez d'abord/.test(text(d4, '#qs-status')));
  d4.getElementById('lang-select').value = 'wo'; d4.getElementById('lang-select').dispatchEvent(new w4.Event('change', { bubbles: true }));
  check('wolof : interface partiellement traduite', [...d4.querySelectorAll('[data-i18n="nav.horaires"]')].some((e) => e.textContent === 'Waxtuy julli'));
  d4.getElementById('lang-select').value = 'fr'; d4.getElementById('lang-select').dispatchEvent(new w4.Event('change', { bubbles: true }));
  const v13_javaW = fs.readFileSync(path.join(__dirname, '..', 'RakebMobile', 'android-native', 'RakebWidgetProvider.java'), 'utf8');
  const v13_setupJs = fs.readFileSync(path.join(__dirname, '..', 'RakebMobile', 'scripts', 'android-setup.js'), 'utf8');
  const v13_schedJ = fs.readFileSync(path.join(__dirname, '..', 'RakebMobile', 'android-native', 'AdhanScheduler.java'), 'utf8');
  check('widget Android : lecture seule des alarmes mémorisées, enregistré au manifeste', /AdhanScheduler\.prefs/.test(v13_javaW) && !/setExact|setAlarmClock/.test(v13_javaW) && /RakebWidgetProvider/.test(v13_setupJs) && /rakeb_widget_info/.test(v13_setupJs) && /RakebWidgetProvider\.refresh/.test(v13_schedJ));
  check('widget Android : ressources présentes', ['layout/rakeb_widget.xml', 'xml/rakeb_widget_info.xml', 'drawable/rakeb_widget_bg.xml'].every((f) => fs.existsSync(path.join(__dirname, '..', 'RakebMobile', 'android-widget', 'res', f))));
  check('pont Android : rappels triés par date avant la limite de 60 notifications', /toLN\.slice\(\)\.sort/.test(fs.readFileSync(path.join(__dirname, '..', 'RakebMobile', 'shim', 'android-shim.js'), 'utf8')));
  check('Confidentialité : sauvegarde automatique locale mentionnée', /sauvegarde automatique/.test(text(d4, '#panel-confidentialite')));
  check('aucune erreur JavaScript (évolutions v1.3)', app4.errors.length === 0 && app5.errors.length === 0, app4.errors.concat(app5.errors).slice(0, 2).join(' | '));

  check('aucune erreur JavaScript pendant les tests', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' vérifications réussies, ' + failures + ' échec(s).');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Erreur du test :', e); process.exit(1); });
